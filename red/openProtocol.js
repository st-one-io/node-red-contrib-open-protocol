//@ts-check
/*
  Copyright: (c) 2018-2020, Smart-Tech Controle e Automação
  GNU General Public License v3.0+ (see LICENSE or https://www.gnu.org/licenses/gpl-3.0.txt)
*/

/*
  Copyright: (c) 2020, Jeremy London
  GNU General Public License v3.0+ (see LICENSE or https://www.gnu.org/licenses/gpl-3.0.txt) 
*/
// Use desoutter modified packaged
const openProtocol = require('node-open-protocol-desoutter');
const { EventEmitter } = require('events');
const base = require('../base.json');

module.exports = function(RED) {
  // <Begin> --- Config ---
  function OpenProtocolConfig(values) {
    EventEmitter.call(this);
    /**
     *
      Default listener count is 10, but if more is requested in the config, a memory leak error is thrown
      60 is needed per Desoutter controller
     *
    **/
    EventEmitter.defaultMaxListeners = 60;
    RED.nodes.createNode(this, values);

    const node = this;

    node.controllerIP = values.controllerIP;
    node.controllerPort = Number(values.controllerPort);
    node.keepAlive = values.keepAlive;
    node.timeout = values.timeout;
    node.retries = values.retries;
    node.rawData = values.rawData;
    node.genericMode = values.generic;
    node.forceLinkLayer = values.linkLayer;
    node.disablemidparsing = values.disablemidparsing;

    node.userDisconnect = false;
    node.onClose = false;

    const parsingDisable = {};

    node.disablemidparsing
      .split(/[,; ]+/)
      .map(item => Number(item))
      .forEach(elm => {
        parsingDisable[elm] = true;
      });

    if (node.forceLinkLayer === 'false') {
      node.forceLinkLayer = false;
    } else if (node.forceLinkLayer === 'true') {
      node.forceLinkLayer = true;
    } else {
      node.forceLinkLayer = undefined;
    }

    const opts = {
      linkLayerActivate: node.forceLinkLayer,
      genericMode: node.genericMode,
      keepAlive: Number(node.keepAlive),
      rawData: node.rawData,
      timeOut: Number(node.timeout),
      retryTimes: Number(node.retries),
      disableMidParsing: parsingDisable,
    };

    node.connectionStatus = false;

    node.connect = function connect() {
      if (node.connectionStatus) {
        return;
      }

      clearTimeout(node.timerReconnect);

      node.op = openProtocol.createClient(node.controllerPort, node.controllerIP, opts, data =>
        node.onConnect(data),
      );
      node.op.on('error', err => node.onErrorOP(err));
    };

    node.connect();

    node.onConnect = function onConnect(data) {
      clearTimeout(node.timerReconnect);

      node.connectionStatus = true;

      node.op.on('__SubscribeData__', data => node.onSubscribeDataOP(data));
      node.op.on('close', error => node.onCloseOP(error));
      node.op.on('connect', data => node.onConnectOP(data));
      node.op.on('data', data => node.onDataOP(data));
      node.emit('connect', data);
    };

    node.disconnect = function disconnect() {
      node.removeListenersOP();

      node.op.close();

      node.connectionStatus = false;
      node.emit('disconnect');

      node.userDisconnect = true;
    };

    node.reconnect = function reconnect() {
      clearTimeout(node.timerReconnect);

      if (node.onClose || node.userDisconnect || node.connectionStatus) {
        return;
      }

      node.connect();
    };

    // Begin::Event of Session Control Client - Open Protocol
    node.onErrorOP = function onErrorOP(error) {
      if (node.onClose) {
        return;
      }

      node.connectionStatus = false;

      node.emit('disconnect');

      node.error(
        `${RED._('open-protocol.message.failed-connect')} ${error.address}:${error.port} ${
          error.code
        }`,
      );

      node.removeListenersOP();

      clearTimeout(node.timerReconnect);
      node.timerReconnect = setTimeout(() => node.reconnect(), 5000);
    };

    node.onCloseOP = function onCloseOP(error) {
      if (node.onClose) {
        return;
      }

      node.connectionStatus = false;
      node.emit('disconnect');

      node.removeListenersOP();

      clearTimeout(node.timerReconnect);
      node.timerReconnect = setTimeout(() => node.reconnect(), 5000);
    };

    node.onConnectOP = function onConnectOP(data) {
      node.emit('connect', data);
    };

    node.onDataOP = function onDataOP(data) {
      node.emit('data', data);
    };

    node.onSubscribeDataOP = function onSubscribeDataOP(data) {
      node.emit(data.key, data.data);
    };

    node.removeListenersOP = function removeListenersOP() {
      node.op.removeListener('error', err => node.onErrorOP(err));
      node.op.removeListener('__SubscribeData__', data => node.onSubscribeDataOP(data));
      node.op.removeListener('close', error => node.onCloseOP(error));
      node.op.removeListener('connect', data => node.onConnectOP(data));
      node.op.removeListener('data', data => node.onDataOP(data));
    };
    // End::Event of Session Control Client - Open Protocol

    node.on('close', () => {
      node.onClose = true;
      clearTimeout(node.timerReconnect);

      node.removeListenersOP();

      node.connectionStatus = false;
      node.emit('disconnect');
      node.op.close();
    });
  }

  
  /*
    Copyright: (c) 2020, Jeremy London
    GNU General Public License v3.0+ (see LICENSE or https://www.gnu.org/licenses/gpl-3.0.txt) 
  */
  // Use desoutter-config name
  RED.nodes.registerType('desoutter-config', OpenProtocolConfig);
  // <End> --- Config

  // <Begin> --- Node
  function OpenProtocolNode(values) {
    RED.nodes.createNode(this, values);

    const node = this;

    node.config = RED.nodes.getNode(values.config);

    node.midGroup = values.midGroup;
    node.customMid = values.customMid;
    node.revision = values.revision;
    node.customRevision = values.customRevision;
    node.autoSubscribe = values.autoSubscribe;
    node.forwardErrors = values.forwardErrors;

    node.config.on('connect', data => node.onConnect(data));
    node.config.on('disconnect', () => node.onDisconnect());

    node.onConnect = function onConnect(data) {
      node.status({
        fill: 'green',
        shape: 'ring',
        text: RED._('open-protocol.util.label.connected'),
      });

      if (node.midGroup === 'Connect') {
        const message = {};
        message.payload = data.payload;
        setMessage(message, data);
        node.send(message);
      }

      if (base[node.midGroup]) {
        if (node.autoSubscribe && base[node.midGroup].typeRequest === 'SUBSCRIBE') {
          onInput(node, {});
        }
      }
    };

    node.onDisconnect = function onDisconnect() {
      node.status({
        fill: 'red',
        shape: 'ring',
        text: RED._('open-protocol.util.label.disconnected'),
      });

      if (base[node.midGroup]) {
        const reference = base[node.midGroup];
        node.config.removeListener(reference.family, node.onSubscribe);
      }
    };

    node.onData = function onData(data) {
      const message = {};
      message.payload = data.payload;
      setMessage(message, data);

      if (node.midGroup === 'Custom') {
        node.send(message);
      } else {
        node.send([null, message]);
      }
    };

    node.onSubscribe = function onSubscribe(data) {
      const message = {};
      message.payload = data.payload;
      setMessage(message, data);

      // Alarm MID  ->> [Feedback, Data, Status, ACK]
      if (node.midGroup === 71) {
        if (data.mid === 71) {
          // Data
          node.send([null, message, null, null]);
          return;
        }

        if (data.mid === 76) {
          // Status
          node.send([null, null, message, null]);
          return;
        }

        if (data.mid === 74) {
          // ACK
          node.send([null, null, null, message]);
        }
      } else {
        node.send([null, message]);
      }
    };

    if (node.midGroup === 'Custom') {
      node.config.on('data', data => node.onData(data));
    }

    node.on('input', msg => {
      if (node.midGroup === 'Custom') {
        const opts = {
          revision: msg.revision,
          payload: msg.payload,
        };

        node.config.op.sendMid(msg.mid, opts).catch(err => {
          msg.error = err.stack || err;

          if (node.forwardErrors) {
            node.send([msg, null]);
          }

          node.error(`${RED._('open-protocol.message.error-send-mid')} - ${err}`, msg);
        });

        return;
      }

      if (node.midGroup === 'Connect') {
        if (msg.connect != undefined) {
          if (msg.connect) {
            node.config.connect();
          } else {
            node.config.disconnect();
          }
        }

        return;
      }

      onInput(node, msg);
    });

    node.on('close', () => {
      node.config.removeListener('connect', data => node.onConnect(data));
      node.config.removeListener('disconnect', () => node.onDisconnect());

      if (base[node.midGroup]) {
        const reference = base[node.midGroup];
        node.config.removeListener(reference.family, node.onSubscribe);
      }

      // Alarm MID
      if (node.midGroup === 71) {
        node.config.removeListener('alarmAcknowledged', node.onSubscribe);
        node.config.removeListener('alarmStatus', node.onSubscribe);
      }
    });

    function onInput(node, msg) {
      const reference = base[node.midGroup];
      const opts = {};
      opts.revision = node.revision || msg.revision;
      opts.revision = node.adjustRevision(opts.revision);

      if (msg.payload) {
        opts.payload = msg.payload || '';
      }

      switch (reference.typeRequest) {
        case 'REQUEST':
          node.config.op
            .request(reference.family, opts)
            .then(data => {
              msg.payload = data.payload;
              setMessage(msg, data);
              node.send(msg);
            })
            .catch(err => {
              msg.error = err.stack || err;
              if (node.forwardErrors) {
                node.send(msg);
              }
              node.error(`${RED._('open-protocol.message.error-request')} - ${err}`, msg);
            });

          break;

        case 'SUBSCRIBE':
          if (msg.subscribe !== undefined && !msg.subscribe) {
            node.config.op
              .unsubscribe(reference.family)
              .then(data => {
                msg.payload = data.payload;
                setMessage(msg, data);
                node.send([msg, null]);
                node.config.removeListener(reference.family, node.onSubscribe);

                // Alarm MID
                if (node.midGroup === 71) {
                  node.config.removeListener('alarmAcknowledged', node.onSubscribe);
                  node.config.removeListener('alarmStatus', node.onSubscribe);
                }
              })
              .catch(err => {
                msg.error = err.stack || err;
                if (node.forwardErrors) {
                  node.send([msg, null]);
                }
                node.error(`${RED._('open-protocol.message.error-unsubscribe')} - ${err}`, msg);
              });

            return;
          }

          node.config.op
            .subscribe(reference.family, opts)
            .then(data => {
              msg.payload = data.payload;
              setMessage(msg, data);
              node.send([msg, null]);

              node.config.on(reference.family, node.onSubscribe);

              // Alarm MID
              if (node.midGroup === 71) {
                node.config.on('alarmAcknowledged', node.onSubscribe);
                node.config.on('alarmStatus', node.onSubscribe);
              }
            })
            .catch(err => {
              msg.error = err.stack || err;
              if (node.forwardErrors) {
                node.send([msg, null]);
              }

              node.error(`${RED._('open-protocol.message.error-subscribe')} - ${err}`, msg);
            });

          break;

        case 'COMMAND':
          node.config.op
            .command(reference.family, opts)
            .then(data => {
              msg.payload = data.payload;
              setMessage(msg, data);
              node.send(msg);
            })
            .catch(err => {
              msg.error = err.stack || err;
              if (node.forwardErrors) {
                node.send(msg);
              }
              node.error(`${RED._('open-protocol.message.error-command')} - ${err}`, msg);
            });

          break;
      }
    }

    node.adjustRevision = function adjustRevision(revision) {
      if (revision === 'Custom') {
        return node.customRevision;
      }

      if (revision === 'Auto') {
        return undefined;
      }

      return Number(revision);
    };

    function setMessage(msg, data) {
      msg.mid = data.mid;
      msg.revision = data.revision;
      msg.noAck = data.noAck;
      msg.stationID = data.stationID;
      msg.spindleID = data.spindleID;
      msg.sequenceNumber = data.sequenceNumber;
      msg.messageParts = data.messageParts;
      msg.messageNumber = data.messageNumber;

      if (node.config.rawData) {
        msg._rawData = data._raw;
      }
    }
  }

  /*
    Copyright: (c) 2020, Jeremy London
    GNU General Public License v3.0+ (see LICENSE or https://www.gnu.org/licenses/gpl-3.0.txt) 
  */
  // Use desoutter-node name
  RED.nodes.registerType('desoutter-node', OpenProtocolNode);
  // <End> --- Node
};
