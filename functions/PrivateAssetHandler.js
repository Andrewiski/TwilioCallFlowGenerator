const fs = require('fs');
//const got = require('got');
const https = require('https');
exports.handler = function(context, event, callback) {
   //The Asset must be marked as Private
   try {

    const authHeader = event.request.headers.authorization;

    // Reject requests that don't have an Authorization header
    if (!authHeader) return callback(null, setUnauthorized(response));
    const [authType, credentials] = authHeader.split(' ');
    // If the auth type doesn't match Basic, reject the request
    if (authType.toLowerCase() !== 'basic')
        return callback(null, setUnauthorized(response));

    // The credentials are a base64 encoded string of 'username:password',
    // decode and split them back into the username and passwo rd
    const [username, password] = Buffer.from(credentials, 'base64')
        .toString()
        .split(':');
    // If the username or password don't match the expected values, reject
    if (username !== context.ACCOUNT_SID || password !== context.AUTH_TOKEN)
        return callback(null, setUnauthorized(response));
     const assets = Runtime.getAssets();
     let file = event.file ;
     if(file.startsWith("/") === false){
        file = "/" + file;
     }
     if(assets[file] && assets[file].path){
        const assetRawText = fs.readFileSync(assets[file].path, 'utf8');
        return callback(null, assetRawText);
     }         
     else{
       var error = new Error("Invalid File Name");
       return callback(null, error);  
     }
      
      
      
  } catch (error) {
    // In the event of an error, return a 500 error and the error message
    console.error(error);
    return callback(error);
  }
  
};