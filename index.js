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
let breakPaths = [];

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
	console.log("req.url", req.url);
  if (breakPaths.indexOf(req.url) >= 0) {
	  console.log('Intentionally breaking request with path ' + req.url);
    res.writeHead(500, {'X-Monkey-Error':'Intentionally breaking request with path ' + req.url});
    res.end();
  } else if (recorder.isRecording) {
		console.log("proxyURL", proxyURL);
	  proxy.web(req, res, {
	    target: proxyURL
	  });
	} else {
		recorder.replay(req, res);
	}
});

console.log("Listening on", 36851);
server.listen(36851);





var configApp = express();
configApp.use(bodyParser.json());

configApp.post('/record', (req, res) => {
	recorder.path = req.body.path;
	breakPaths = req.body.breakPaths;
	proxyURL = req.body.host;

	recorder.startRecording((error) => {
		if (error) {
			res.sendStatus(500);
		} else {
			res.sendStatus(200);
		}
	});
});

// if the path already exists, playback, otherwise record
configApp.post('/record-if-needed', (req, res) => {
	recorder.path = req.body.path;
	breakPaths = req.body.breakPaths;

	fs.stat(req.body.path, (err, stat) => {
    if(err == null && stat.isFile()) {
      recorder.startPlayback((error) => {
				if (error) {
					res.sendStatus(500);
				} else {
					res.sendStatus(200);
				}
			});
    } else {
			proxyURL = req.body.host;

			recorder.startRecording((error) => {
				if (error) {
					res.sendStatus(500);
				} else {
					res.sendStatus(200);
				}
			});
		}
	});
});

configApp.post('/playback', (req, res) => {
	recorder.path = req.body.path;
	breakPaths = req.body.breakPaths;

	recorder.startPlayback((error) => {
		if (error) {
			res.sendStatus(500);
		} else {
			res.sendStatus(200);
		}
	});
});

var configServer = configApp.listen(36852, ()  => {
  var host = configServer.address().address;
  var port = configServer.address().port;

  console.log("Config server listening at http://%s:%s", host, port);
});
