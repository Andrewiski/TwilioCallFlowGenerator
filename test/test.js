'use strict';
const httpport = 49980
const http = require('http');
const https = require('https');
//const Url = require('url');
const path = require('path');
const fs = require('fs');
const express = require('express');
const favicon = require('serve-favicon');
const Deferred = require('node-promise').defer;
const FormData = require('form-data');
const formidable = require('formidable');
const util = require('util');
var app = express();
var parentPath = path.dirname(__dirname)
app.use(express.static(path.join(parentPath, '/assets'), { maxAge: 0 }));

// disable the x-power-by express message in the header
app.disable('x-powered-by');
app.use(favicon(path.join(parentPath, '/assets/favicon.ico')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let rootUrlServerless = "https://serverless-upload.twilio.com/v1";

//let rootUrlServerless = "http://127.0.0.1:49980/uploadtest";

var createFunctionVersion = function(options){ 
    var deferred = Deferred();
  
    try{         
      var url = rootUrlServerless + "/Services/" + options.ServiceSid + "/Functions/" + options.FunctionSid + "/Versions" ;
      var formData = new FormData();
         
      var blob = Buffer.from(options.fileData,'base64');
      formData.append("Path", options.path);
      formData.append("Visibility", "public")
      formData.append("Content", blob, {fileName:options.fileName, contentType:"application/javascript"});
      var authHeaderString = Buffer.from(options.accountSid + ":" + options.authToken).toString('base64');
      
      var myUrl = new URL(url);
      var formOptions = {
        port: myUrl.port,
        path: myUrl.pathname,
        host: myUrl.hostname,
        protocol: myUrl.protocol,
        headers: {"Authorization": "Basic " + authHeaderString}
      }
      var retval = "";
      formData.submit(formOptions, function(err, res) {
        if (err) {
          deferred.reject(err);
        }else{
          res.on('data', (chunk) => {
            retval = retval + chunk.toString();
            //console.log(chunk) // this is your response body
          })
          res.on('end', function(){
              deferred.resolve(retval);
          })
        }
      }  
      )
       
      
    }catch(ex){
      deferred.reject(ex);
    }
    return deferred.promise;
}

var createAssetVersion = function(options){ 
  var deferred = Deferred();

  try{         
    var url = rootUrlServerless + "/Services/" + options.ServiceSid + "/Assets/" + options.AssetSid + "/Versions" ;
    var formData = new FormData();
       
    var blob = Buffer.from(options.Content,'base64');
    formData.append("Path", options.path);
    formData.append("Visibility", "public")
    formData.append("Content", blob, {fileName:options.fileName, contentType:"application/javascript"});
    var authHeaderString = Buffer.from(options.accountSid + ":" + options.authToken).toString('base64');
    
    var myUrl = new URL(url);
    var formOptions = {
      port: myUrl.port,
      path: myUrl.pathname,
      host: myUrl.hostname,
      protocol: myUrl.protocol,
      headers: {"Authorization": "Basic " + authHeaderString}
    }
    var retval = "";
    formData.submit(formOptions, function(err, res) {
      if (err) {
        deferred.reject(err);
      }else{
        res.on('data', (chunk) => {
          retval = retval + chunk.toString();
          //console.log(chunk) // this is your response body
        })
        res.on('end', function(){
            deferred.resolve(retval);
        })
      }
    }  
    )
     
    
  }catch(ex){
    deferred.reject(ex);
  }
  return deferred.promise;
}







app.use("/uploadAssetTest", function(req,res, next){
  
  // This if statement is here to catch form submissions, and initiate multipart form data parsing.

    if ( req.method.toLowerCase() == 'post') {

      // Instantiate a new formidable form for processing.

      var form = new formidable.IncomingForm();

      // form.parse analyzes the incoming stream data, picking apart the different fields and files for you.

      form.parse(req, function(err, fields, files) {
        if (err) {

          // Check for and handle any errors here.

          console.error(err.message);
          return;
        }
        res.writeHead(200, {'content-type': 'text/plain'});
        res.write('received upload:\n\n');

        // This last line responds to the form submission with a list of the parsed data and files.
        files.write()
        res.end(util.inspect({fields: fields, files: files}));
      });
      return;
    }

    // If this is a regular request, and not a form submission, then send the form.

    res.writeHead(200, {'content-type': 'text/html'});
    res.end(
      '<form action="/uploadtest" enctype="multipart/form-data" method="post">'+
      '<input type="text" name="title"><br>'+
      '<input type="file" name="upload" multiple="multiple"><br>'+
      '<input type="submit" value="Upload">'+
      '</form>'
    )
});


app.use("/serverless-upload/v1/Services/:ServiceSid/Assets/:AssetSid/Versions/:AssetVersionSid", function(req,res, next){
  
  try{          
    var url = rootUrlServerless + "/Services/" + req.params.ServiceSid + "/Assets/" + req.params.AssetSid + "/Versions/" + req.params.AssetVersionSid;
    let authorization = req.headers.authorization;
    var httpOptions = {
      url: url, 
      headers: {"Authorization": authorization},
      method: "GET",
    }
    https.get(url, httpOptions,  (resp) => {
      let data = '';

      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        console.log(data);
        res.send(data);
      });

      }).on("error", (err) => {
         console.log("Error: " + err.message);
         res.send(ex, err.statusCode);
      });
  }catch(ex){
    res.send(ex, 500)
  }        
})
app.use("/createFunctionVersion", function(req,res, next){
    createFunctionVersion(req.body).then(
        function(retval){
            res.status(200).send(retval);
        },
        function(ex){
            res.status(500).send(ex);
            
        }
    )
    
})

app.use("/createAssetVersion", function(req,res, next){
  createAssetVersion(req.body).then(
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