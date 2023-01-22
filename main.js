(() => {
	var HTTPS = require("https");
	var HTTP = require("http");
	var FS = require("fs");
	var PATH = require("path");
	var URL = require("url");

	//var {Parse} = require("parse.js");
	//var {Controller} = require("controller.js");
	
	

 	function Error(code, message) {
		var extra = message ? ["<span>", message, "</span>"].join("") : "";
		var error = "<h1>Error 500</h1><p>Internal Server Error</p>";
		switch(code) {
			case 404: {
				error = "<h1>Error 404</h1><p>File Not Found</p>";
				break;
			}
			case 500:
			default: {
				break;
			}
		}
		return `<!DOCTYPE html><html><head></head><body>${error}${extra}</body></html>`;
	}
	function GetContentType(str) {
		var s = str.split(/[.]/g);
		switch (s[s.length - 1]) {
			case "wav": {
				return "audio/wav";
			}
			case "ogg": {
				return "audio/ogg";
			}
			case "mp3": {
				return "audio/mp3";
			}
			case "ico": {
				return "image/x-icon";
			}
			case "gif": {
				return "image/gif";
			}
			case "png": {
				return "image/png";
			}
			case "jpg":
			case "jpeg": {
				return "image/jpeg";
			}
			case "js": {
				return "text/javascript";
			}
			case "json": {
				return "application/json";
			}
			case "css": {
				return "text/css";
			}
			case "wasm": {
				return "application/wasm";
			}
			case "html":
			case "htm": {
				return "text/html; charset=UTF-8";
			}
			case "bin": {
				return "application/octet-stream";
			}
			default: {
				return "text/plain";
			}
		}
	};
	// fnDone(filename, error, errorMessage)
	function SaveFile(file, encoding, data, fnDone) {
		FS.open(file, 'w+', function(err, fd) {
			if(err !== null) return fnDone(file, true, err);//console.log(`- OpenFile request failed to open file -\n\t${_file}\n`);
			FS.write(fd, data, function(err, bytesWritten, buffer) {
				if (err != null) return fnDone(file, true, err);
				FS.close(fd, function(err) {
					if (err !== null) return;//console.log(`- OpenFile request failed to close file -\n\t${_file}\n`);
					fnDone(file, false);
				});
			});
		});
	};
	// fnDone: file, data, status
	function OpenFile(file, encoding, fnDone, fnError) {
		((_file, _encoding, _fnDone, _fnError) => {
			_fnDone = _fnDone || (() => {});
			_fnError = _fnError || (() => {});
			var encoding = _encoding || 'utf8'; 
			//var web = electron.BrowserWindow.fromId(_uuid);
			FS.open(_file, 'r', function(err, fd) {
				if(err !== null) return _fnDone(_file, "file not found", 404);//console.log(`- OpenFile request failed to open file -\n\t${_file}\n`);
				FS.fstat(fd, function(err, stats) {
					if (err !== null) return _fnDone(_file, "file not found", 404);//console.log(`- OpenFile fstat failed -\n\t${_file}`);
					var fileSize = stats.size + 1;
					FS.read(fd, {buffer: Buffer.alloc(fileSize)}, function(err, bytes, buffer) {
						if(err !== null) return _fnDone(_file, "file not found", 404);//fnError(`- OpenFile request failed to read file -\n\t${_file}\n`);
						var content = buffer.toString(encoding, 0, bytes);
						_fnDone(PATH.resolve(_file), {text: buffer, raw: buffer}, 200);
						FS.close(fd, function(err) {
							if (err !== null) return;//console.log(`- OpenFile request failed to close file -\n\t${_file}\n`);
						});
					});
				});
			});
		})(file, encoding, fnDone, fnError);
	};



	/*  */
	/*function Put(request, response) {
		//type = "text/html";
		response.writeHead(status, {"Content-Length": Buffer.byteLength(content) - 1, "Content-Type": type});
		response.write(content);
		response.end();
	};*/

	/*  */
	function Post(request, response) {
		try {
			var chunk = [];
			request.on("data", function(data) {
				if (request.headers["content-type"] == "multipart/form-data")
					return;
				chunk[chunk.length] = data;
			});

			request.on("end", function() {
				chunk = chunk.join('');
				var pchunk = chunk;
				var type = "";
				if (request.headers["content-type"])
					type = request.headers["content-type"].split(";")[0];
				var headers = {"Content-Type": "text/html; charset=UTF-8"};
				var status = 200;
				switch(type) {
					case "text/plain": { // debug
						status = 200;
						headers["Content-Length"] = chunk.length;
						break; 
					}
					case "application/x-www-form-urlencoded": {// default form
						status = 303;
						headers["Location"] = request.url;
						break;
					}
					case "multipart/form-data": // form input type=file for file upload
					default: {
						//console.log("i am here");
						status = 500;
						pchunk = chunk;
						chunk = Error(500, "Illegal file upload has been logged");//"<!DOCTYPE html><html><head></head><body><h1>Error 500</h1><p>Internal Server Error</p><div>File upload unsupported</div></body></html>"
						break; 
					}
				};
				response.writeHead(status, headers);
				if (type != "application/x-www-form-urlencoded") // todo ? write stuff or redirect
					response.write(chunk.toString());
				console.log("POST request data: ", pchunk);
				response.end();
			});
		}
		catch(e) {
			console.log("fatal error in Post(): ", e);
		};
	};

	/*  */
	function Get(request, response) {
		try {
			var queryStrings = [];
			var url = URL.parse(request.url, true);//.query
			/*for(var str in url.query) // fix null prototype that URL.parse returns
				queryStrings[str] = url.query[str];*/
			if (url.pathname == "/")
				url.pathname = "/index.html";
			else if (url.pathname[url.pathname.length - 1] == "/")
				url.pathname = [url.pathname, "/index.html"].join("");
			var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), url.pathname)));
			OpenFile(filename, 'utf8', function(filepath, contents, status) {
				filepath = filepath || "";
				//var splits = filepath.split(/[.]/g);
				var type = "text/html; charset=UTF-8";
				var content = Error(500);//"<!DOCTYPE html><html><head></head><body><h1>Error 500</h1><p>Internal Server Error</p></body></html>";
				if (status == 200) {// && splits.length > 1) {
					content = contents.text;
					//var vl = splits[splits.length - 1].toLowerCase();
					type = GetContentType(filename);
				}
				else if (status == 404) {
					content = Error(404);//"<!DOCTYPE html><html><head></head><body><h1>Error 404</h1><p>File Not Found</p></body></html>";
				}

				response.writeHead(status, {"Content-Length": Buffer.byteLength(content) - 1, "Content-Type": type});
				response.write(content);
				response.end();
			});
		}
		catch(e) {
			console.log("fatal error in Get(): ", e);
		}
	};
	function Head(request, response) {
		try {
			var url = URL.parse(request.url, true);//.query
			var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), url.pathname)));
			var headers = {"Content-Type": "text/html; charset=UTF-8"};
			OpenFile(filename, 'utf8', function(filepath, contents, status) {
				if (status == 200) {
					headers["Content-Length"] = Buffer.byteLength(contents.text) - 1;
					headers["Content-Type"] = GetContentType(filename);
				}
				response.writeHead(status, headers);//{"Content-Length": Buffer.byteLength(content) - 1, "Content-Type": type});
				response.end();
			});
		}
		catch(e) {
			console.log("fatal error in Head(): ", e);
		}
	};

	/*  */
	function BadRequest(request, response, details) {
		var content = Error(500, details);//`<!DOCTYPE html><html><head></head><body><h1>Error 500</h1><p>Internal Server Error</p><div>${details}</div></body></html>`;
		response.writeHead(500, {"Content-Length": Buffer.byteLength(content) - 1, "Content-Type": "text/html; charset=UTF-8"});
		response.write(content);
		response.end();
	};
	
	/*  */
	function HttpRequest(request, response) {
		try {
			var now = new Date();
			var host = request.headers["host"];
			var remoteAddress = request.headers["x-forwarded-for"];
			var fromAddress = request.connection.remoteAddress;
			var fromString = remoteAddress ? `${remoteAddress}(${fromAddress})` : fromAddress;
			var url = URL.parse(request.url, true);
			var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), url.pathname)));
			if (hostname != null && (host == undefined || host.toLowerCase() != hostname.toLowerCase()))  {
				console.log("=====\n%s\nCANCELED CONNECTIONS %s HTTP/%s request from %s\nMismatched hostname", 
						now,
						request.method, 
						request.httpVersion,
						fromString);
				response.destroy();
				return response.socket.end();
			}
			console.log("=====\n%s\n%s HTTP/%s request from %s\nserving: %s\nrequested url: %s\n%o\n", 
						now,
						request.method, 
						request.httpVersion,
						fromString,
						filename,
						request.url,
						request.headers);
			switch(request.method.toUpperCase()) {
				case 'POST': {
					Post(request, response);
					break;
				}
				case 'GET': {
					Get(request, response);
					break;
				}
				case 'HEAD': {
					Head(request, response);
					break;
				}
				case 'PUT':
				case 'DELETE':
				case 'PATCH':
				case 'OPTIONS':
				case 'CONNECT':
				case 'TRACE':
				default: {
					BadRequest(request, response, `Illegal ${request.method} requests has been logged.`);
					break;
				}
			}
		}
		catch(e) {
			console.log("fatal error in HttpRequest(): ", e);
		}
	}
	var WebServerStates = {
		lastHttpRequestLogTime: new Date().getTime()
	};

	var hostname = null;
	var sslEnabled = false;
	var port = 8888;
	var sslPort = 444;
	var keyPath = "";
	var certPath = "";
	var opts = { timeout: 10000,requestTimeout: 1000, headersTimeout: 1000, key: "", cert: ""};
	if (process.argv.length > 1) {
		for (var i = 1; i < process.argv.length; i++) {
			var arg = process.argv[i].toLowerCase();
			switch(arg) {
				case "-p":
				case "-port":{
					if (i+1 < process.argv.length)
						port = parseInt(process.argv[i+1]);
					break;
				}
				case "-sp":
				case "-sport":{
					if (i+1 < process.argv.length)
						sslPort = parseInt(process.argv[i+1]);
					//opts.key = FS.readFileSync(opts.key);
					//opts.cert = FS.readFileSync(opts.cert);
					break;
				}
				case "-ssl":{
					sslEnabled = true;
					break;
				}
				case "-key":{
					if (i+1 < process.argv.length)
						keyPath = process.argv[i+1];
					break;
				}
				case "-cert":{
					if (i+1 < process.argv.length)
						certPath = process.argv[i+1];
					break;
				}
				case "-hostname": {
					if (i+1 < process.argv.length)
						hostname = process.argv[i+1];
					console.log("hostname is now %s", hostname);
					break;
				}
				default: {
					break;
				}
			};
		}
	}
	var server = HTTP.createServer(opts, HttpRequest);
	server.listen(port);
	server.setTimeout(opts.timeout);
	console.log("webserverjs: listening on port %i", port);
	if (sslEnabled) {
		opts.key = FS.readFileSync(keyPath);
		opts.cert = FS.readFileSync(certPath);
		var sslServer = HTTPS.createServer(opts, HttpRequest);cb
		sslServer.listen(sslPort);
		sslServer.setTimeout(opts.timeout);
		console.log("webserverjs: listening on port %i (ssl)", sslPort);
	}

})();