"use strict";

let fs = require('fs');
let mkdirp = require('mkdirp');
let path = require('path');

class Recorder {
	constructor(height, width) {
		this.isRecording = false;
    this.recordings = [];

		console.log("Recorder created")
  }

	startRecording(callback) {
		this.isRecording = true;
		this.recordings = [];

		mkdirp(path.dirname(this.path), (err) => {
		  if (err) {
				console.error(err);
			} else {
				console.log(`Recording started at ${this.path} to ${this.host}`);
			}

			callback(err);
		})
	}

	startPlayback(callback) {
		this.isRecording = false;

		fs.readFile(this.path, 'utf8', (err, data) => {
		  if (err) {
		    console.log(err);
		  } else {
				this.recordings = JSON.parse(data);
				console.log(`Playing back from ${this.path} with ${this.recordings.length} recordings`);
			}

			callback(err);
		});
	}

	//// Recording

	writeRecordings() {
		let contents = JSON.stringify(this.recordings, true, 2);
		fs.writeFile(this.path, contents, (err) => {
		  if (err) {
		    return console.log(err);
		  }

		  console.log(`Recordings saved to ${this.path}`);
		});
	}

	record(req, res) {
		if (!this.isRecording) {
			console.log("Trying to record when not in recording mode!");
			res.writeHead(500, {'X-Monkey-Error':'Trying to record in replay mode'});
			return;
		}

		let body = '';
		res.on('data', (chunk) => {
			body += chunk;
		});
		res.on('end', () => {
			let recording = {
				request: {
					method: req.method.toUpperCase(),
					url: req.url.toLowerCase(),
				},
				response: {
					statusCode: res.statusCode,
					headers: res.headers,
				},
			}

			if (res.headers['content-type'] && res.headers['content-type'].indexOf('application/json') > -1) {
				recording['response']['json'] = JSON.parse(body);
			} else {
				recording['response']['body'] = body;
			}

			this.recordings.push(recording);
			this.writeRecordings();
			console.log('recorded', JSON.stringify(recording, true, 2));
		});
	}


	//// Playback

	recordingFor(req) {
		for (let recording of this.recordings) {
		  if (recording['request']['method'].toUpperCase() === req.method.toUpperCase()
					&& recording['request']['url'].toLowerCase() === req.url.toLowerCase()) {
				this.recordings.splice(this.recordings.indexOf(recording), 1);

				return recording
			}
		}

		return null
	}

	replay(req, res) {
		if (this.isRecording) {
			console.log("Trying to replay when in recording mode!");
			res.writeHead(500, {'X-Monkey-Error':'Trying to replay in record mode'});
			return;
		}

		let recording = this.recordingFor(req)
		if (recording !== null) {
			console.log(`Replaying ${JSON.stringify(recording, true, 2)}!`);

			res.writeHead(recording['response']['statusCode'], recording['response']['headers']);

			if (recording['response']['json']) {
				res.end(JSON.stringify(recording['response']['json']));
			} else {
				res.end(recording['response']['body']);
			}
		} else {
			console.log(`No recording found for ${req.method} ${req.url}!`);
			res.writeHead(200, {'X-Monkey-Error':'No recording found'});
			res.end();
		}
	}
}


let recorder = new Recorder();
module.exports = recorder;
