/*
   Copyright 2018 Smart-Tech Controle e Automação

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
"use strict";
/*jshint esversion: 6, node: true*/

const fs = require('fs');
const op = require('open-protocol');
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