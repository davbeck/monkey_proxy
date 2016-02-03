#!/usr/local/bin/node

"use strict";

let http = require('http');
let httpProxy = require('http-proxy');
let express = require('express');
let bodyParser = require('body-parser');
let fs = require('fs');
let recorder = require('./recorder');


//
// Create a proxy server with custom application logic
//
let proxy = httpProxy.createProxyServer({});
let proxyURL = "";

// To modify the proxy connection before data is sent, you can listen
// for the 'proxyReq' event. When the event is fired, you will receive
// the following arguments:
// (http.ClientRequest proxyReq, http.IncomingMessage req,
//  http.ServerResponse res, Object options). This mechanism is useful when
// you need to modify the proxy request before the proxy connection
// is made to the target.
//
proxy.on('proxyRes', (proxyRes, req, res)  => {
	recorder.record(req, proxyRes)
});

proxy.on('error', function( error ){
    console.log( error );
});

var server = http.createServer((req, res)  => {
	if (recorder.isRecording) {
	  proxy.web(req, res, {
	    target: proxyURL
	  });
	} else {
		recorder.replay(req, res)
	}
});

console.log("Listening on", 36851);
server.listen(36851);





var configApp = express();
configApp.use(bodyParser.json());

configApp.post('/record', (req, res) => {
	recorder.path = req.body.path;
	proxyURL = req.body.host;

	recorder.startRecording();

	res.sendStatus(200);
});

// if the path already exists, playback, otherwise record
configApp.post('/record-if-needed', (req, res) => {
	recorder.path = req.body.path;

	fs.stat(req.body.path, (err, stat) => {
    if(err == null && stat.isFile()) {
      recorder.startPlayback();
    } else {
			proxyURL = req.body.host;

			recorder.startRecording();
		}
	});

	res.sendStatus(200);
});

configApp.post('/playback', (req, res) => {
	recorder.path = req.body.path;

	recorder.startPlayback();

	res.sendStatus(200);
});

var configServer = configApp.listen(36852, ()  => {
  var host = configServer.address().address;
  var port = configServer.address().port;

  console.log("Config server listening at http://%s:%s", host, port);
});
