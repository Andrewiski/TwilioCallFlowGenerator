'use strict';
const httpport = 49980
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const favicon = require('serve-favicon');

var app = express();
var parentPath = path.dirname(__dirname)
app.use(express.static(path.join(parentPath, '/assets'), { maxAge: 0 }));

// disable the x-power-by express message in the header
app.disable('x-powered-by');
app.use(favicon(path.join(parentPath, '/assets/favicon.ico')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//app.use(cookieParser());
var http_srv=null;
try {
    http.globalAgent.keepAlive = true;
    http_srv = http.createServer(app).listen(httpport, function () {
        console.log( 'info', 'Express server listening on http port ' + httpport);
        console.log('info', 'http://localhost:' + httpport + '/FlowAssetGenerator.html');
    });
    
    
} catch (ex) {
    console.log( 'error', 'Failed to Start Express server on http port ' + httpport, { message: ex.message, stack: ex.stack });
}