//@ts-check
/*
  Copyright: (c) 2018-2020, Smart-Tech Controle e Automação
  GNU General Public License v3.0+ (see LICENSE or https://www.gnu.org/licenses/gpl-3.0.txt)
*/

const fs = require('fs');
const op = require('node-open-protocol');
const dataMids = op.helpers.getMids();

let mids = {};

//Lista de subscribes
Object.entries(op.constants.subscribes).forEach(element => {

    if(element[1].outList){
        return;
    }

    let obj = {};

    let key = element[1].data;

    obj.text = `${element[1].data} - ${element[0]}`;
    obj.typeRequest = "SUBSCRIBE";
    obj.family = element[0];
    obj.implemented = false;
    obj.revisions = [1];
    obj.params = [];

    if (dataMids[element[1].data]) {
        obj.params = dataMids[element[1].data].params || [];
        obj.revisions = dataMids[element[1].data].revision();
        obj.implemented = true;
    }

    mids[key] = obj;
});

//Lista de Request
Object.entries(op.constants.requests).forEach(element => {

    let obj = {};

    let key = element[1].request;

    if (element[1].reply){
        key = element[1].reply;
    }

    obj.text = `${key} - ${element[0]}`;
    obj.typeRequest = "REQUEST";
    obj.family = element[0];
    obj.implemented = false;
    obj.revisions = [1];
    obj.params = [];

    if (dataMids[element[1].request]) {
        obj.params = dataMids[element[1].request].params || [];
        obj.revisions = dataMids[element[1].request].revision();
        obj.implemented = true;
    }

    mids[key] = obj;
});

//Lista de Commands
Object.entries(op.constants.commands).forEach(element => {

    let obj = {};

    let key = element[1].request;

    obj.text = `${element[1].request} - ${element[0]}`;
    obj.typeRequest = "COMMAND";
    obj.family = element[0];
    obj.implemented = false;
    obj.revisions = [1];
    obj.params = [];

    if (dataMids[element[1].request]) {
        obj.params = dataMids[element[1].request].params || [];
        obj.revisions = dataMids[element[1].request].revision();
        obj.implemented = true;
    }

    mids[key] = obj;
});

let dados = JSON.stringify(mids);

fs.writeFile("./base.json", dados, (err) => {

    if (err) {
        console.log("Ocorreu um erro", err);
        return;
    }

    console.log("Base gerada com sucesso.");

});

let htmlPage = fs.readFileSync("./red/openProtocol.html", "utf8");

let regex = /\/\/__AUTO__GENERATED__[\s\S]*\/\/__AUTO__GENERATED__/;

let template = `//__AUTO__GENERATED__\r\n        let base = ${dados};\r\n        //__AUTO__GENERATED__`;

htmlPage = htmlPage.replace(regex, template);

fs.writeFile("./red/openProtocol.html", htmlPage, (err) => {
    if (err) {
        console.log("Erro ao atualizar o arquivo", err);
        return;
    }

    console.log("Arquivo html atualizado com sucesso");

});