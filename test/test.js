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

let rootUrlServerless = "https://serverless-upload.twilio.com/v1";

var createFunctionVersion = function(options){ 
    var deferred = $.Deferred();
  
    try{         
      var url = rootUrlServerless + "/Services/" + options.ServiceSid + "/Functions/" + options.FunctionSid + "/Versions" ;
      var formData = new FormData();
      getRepoFileContents({url:options.contentUrl}).then(
        function(repoFileData){
          //var content = data.fileContent; // the body of the new file...
          var blob = base64toBlob(repoFileData.content,"application/javascript") //new Blob([content], { type: "text/javascript"});
          formData.append("Path", options.path);
          formData.append("Visibility", "public")
          formData.append(options.fileName, blob);
          var ajaxOptions = {
            url: url, 
            headers: {"Authorization": "Basic " + btoa(options.accountSid + ":" + options.authToken)},
            type: "POST",
            contentType: 'multipart/form-data',
            processData: false,
            // xhrFields: {
            //   withCredentials: true
            // },
            crossDomain: false,
            dataType: 'json',
            data: formData
            //crossDomain: true
          }
          $.ajax(ajaxOptions).then(
            function(functionVersionData){
              deferred.resolve(functionVersionData);
            },
            function( jqXHR, textStatus, errorThrown){
                deferred.reject(errorThrown);
              }
          )
        },
        function(ex){
          deferred.reject(ex);
        }
      )
      
    }catch(ex){
      deferred.reject(ex);
    }
    return deferred.promise();
}

app.use("/createFunctionVersion", function(req,res, next){
    createFunctionVersion(req.data).then(
        function(retval){
            res.status(200).send(retval);
        },
        function(ex){
            res.status(500).send(ex);
            
        }
    )
    
})
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