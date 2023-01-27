(() => {
	var HTTPS = require("https");
	var HTTP = require("http");
	var FS = require("fs");
	var PATH = require("path");
	var URL = require("url");

	//var {Parse} = require("parse.js");
	//var {Controller} = require("controller.js");
	//var resolve = path.resolve(path.normalize(path.join(wwwroot, path)));
	function inRoot(path) {
		if (path.indexOf(wwwroot) == 0) { // this should be sufficient in testing for traversal attempts
			// but for my mental health there will be multiple tests
			var pathSplits = path.split(/[\/]/g);
			var rootSplits = wwwroot.split(/[\/]/g);
			if (pathSplits.length >= rootSplits.length) {
				for(var i = 0; i < rootSplits.length; i++) {
					if (pathSplits[i] != rootSplits[i])
						return false;
				};
			}
			else {
				return false;
			}
			return true;
		}
		return false;
	};
 	function Error(code, message) {
		var extra = message ? ["<span>", message, "</span>"].join("") : "";
		var error = "<h1>Error 500</h1><p>Internal Server Error</p>";
		switch(code) {
			case 400: {
				error = "<h1>Error 400</h1><p>Bad Request</p>";
				break;
			}
			case 403: {
				error = "<h1>Error 403</h1><p>Forbidden</p>";
				break;
			}
			case 404: {
				error = "<h1>Error 404</h1><p>File Not Found</p>";
				break;
			}
			case 500:
			default: {
				break;
			}
		};
		return Buffer.from(`<!DOCTYPE html><html><head></head><body>${error}${extra}</body></html>`);
	};
	function GetContentType(str) {
		//var s = str.split(/[.]/g);
		var ext = str.substring(str.indexOf("."), str.length);
		
		//switch (s[s.length - 1]) {
		switch(ext) {
			case ".wav": {
				return "audio/wav";
			}
			case ".ogg": {
				return "audio/ogg";
			}
			case ".mp3": {
				return "audio/mp3";
			}
			case ".ico": {
				return "image/x-icon";
			}
			case ".gif": {
				return "image/gif";
			}
			case ".png": {
				return "image/png";
			}
			case ".jpg":
			case ".jpeg": {
				return "image/jpeg";
			}
			case ".js": {
				return "text/javascript";
			}
			case ".json": {
				return "application/json";
			}
			case ".css": {
				return "text/css";
			}
			case ".wasm": {
				return "application/wasm";
			}
			case ".html":
			case ".htm": {
				return "text/html; charset=UTF-8";
			}
			case ".zip" :{
				return "application/zip";
			}
			case ".tar.gz": {
				return "applicationh/gzip";
			}
			case ".bin": {
				return "application/octet-stream";
			}
			default: {
				return "text/plain";
			}
		};
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
			FS.open(_file, 'r', function(err, fd) {
				if(err !== null) return _fnDone(_file, "file not found", 404);//console.log(`- OpenFile request failed to open file -\n\t${_file}\n`);
				FS.fstat(fd, function(err, stats) {
					if (err !== null) return _fnDone(_file, "file not found", 404);//console.log(`- OpenFile fstat failed -\n\t${_file}`);
					var fileSize = stats.size + 1;
					FS.read(fd, {buffer: Buffer.alloc(fileSize)}, function(err, bytes, buffer) {
						if(err !== null) return _fnDone(_file, "file not found", 404);//fnError(`- OpenFile request failed to read file -\n\t${_file}\n`);
						_fnDone(PATH.resolve(_file), buffer, 200);
						FS.close(fd, function(err) {
							if (err !== null) return;//console.log(`- OpenFile request failed to close file -\n\t${_file}\n`);
						});
					});
				});
			});
		})(file, encoding, fnDone, fnError);
	};

	function HttpCancelSocket(response) {
		try {
			response.destroy();
			return response.socket.end();
		}
		catch (e) {
			console.log("fatal error in HttpCancelSocket(): ", e);
		}
		return;
	};

	/*  */
	function Post(request, response, httpResponse) {
		try {
			var chunk = [];
			var type = null;
			if (request.headers["content-type"])
				type = request.headers["content-type"].split(";")[0];
			
			request.on("data", function(data) {
				if (type == "multipart/form-data")
					return;
				chunk[chunk.length] = data;
			});

			request.on("end", function() {
				chunk = chunk.join('');
				var pchunk = chunk;
				var headers = {"Content-Type": GetContentType(".html")};
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
					case "multipart/form-data": {// form input type=file for file upload
						return BadRequest(request, response, 500, "Illegal file upload has been logged");
					}
					default: {
						return BadRequest(request, response, 400);
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
			return HttpCancelSocket(response);
		};
	};

	/*  */
	function Get(request, response, httpResponse) {
		try {
			OpenFile(httpResponse.location, 'utf8', function(filepath, contents, status) {
				var type = GetContentType(".html");
				if (status == 200) {
					type = GetContentType(filepath)
					/*response.writeHead(status, {"Content-Length": Buffer.byteLength(contents) - 1, "Content-Type": type});
					response.write(contents);
					response.end();*/
					var totalBytes = Buffer.byteLength(contents) - 1;
					var writtenBytes = 0;
					var nextBytes = 0;

					response.writeHead(status, {"Content-Length": totalBytes, "Content-Type": type});
					function write() {
						clearTimeout(sendTimeout);
						if (writtenBytes + 10 >= totalBytes)
							nextBytes = totalBytes;
						else
							nextBytes += 10;
						response.write(contents.slice(writtenBytes, nextBytes));
						writtenBytes = nextBytes;
						if(writtenBytes == totalBytes) {
							return response.end();
						};
						sendTimeout = setTimeout(write, 100 );
					};
					var sendTimeout = setTimeout(write, 100 );
					console.log("Served %i bytes", Buffer.byteLength(contents) - 1);
					return;
				};
				return BadRequest(request, response, 404);
			});
		}
		catch(e) {
			console.log("fatal error in Get(): ", e);
			return HttpCancelSocket(response);
		}
	};
	function Head(request, response, httpResponse) {
		try {
			var headers = {"Content-Type": GetContentType(".html")};
			OpenFile(httpResponse.location, 'utf8', function(filepath, contents, status) {
				if (status == 200) {
					headers["Content-Length"] = Buffer.byteLength(contents) - 1;
					headers["Content-Type"] = GetContentType(filepath);
				};
				console.log("Served %i bytes", Buffer.byteLength(contents) - 1);
				response.writeHead(status, headers);
				response.end();
				return;
			});
		}
		catch(e) {
			console.log("fatal error in Head(): ", e);
			return HttpCancelSocket(response);
		}
	};

	/*  */
	function BadRequest(request, response, code, details) {
		var content = Error(code, details);
		var remoteAddress = request.headers["x-forwarded-for"];
		var fromAddress = request.connection.remoteAddress;
		var fromString = remoteAddress ? `${remoteAddress}(${fromAddress})` : fromAddress;
		console.log("Rejected %s HTTP/%s request from %s\nError %s: %s\n",
					request.method, request.httpVersion, fromString, code, details || "");
		response.writeHead(code, {"Content-Length": Buffer.byteLength(content), 
								  "Content-Type": GetContentType(".html")});
		response.write(content);
		response.end();
	};
	
	/*  */
	function HttpRequest(request, response) {
		try {
			var now = new Date();
			console.log("=====\n", now);

			var host = request.headers["host"];
			var remoteAddress = request.headers["x-forwarded-for"];
			var fromAddress = request.connection.remoteAddress;
			var fromString = remoteAddress ? `${remoteAddress}(${fromAddress})` : fromAddress;
			if (hostname != null && (host == undefined || host.toLowerCase() != hostname.toLowerCase()))  {
				console.log("Rejected %s HTTP/%s request from %s\nMismatched hostname\n%o\n",
							request.method, request.httpVersion, fromString, request.headers);
				return HttpCancelSocket(response);
			}
			
			var httpResponse = {
				url: null,
				location: null,
				queryStrings: [],
				contentType: GetContentType(".html")
			};
			httpResponse.url = URL.parse(request.url, true);
			if (httpResponse.url.pathname[httpResponse.url.pathname.length - 1] == "/") { // if end of pathname is / then append index.html
				httpResponse.url.pathname = PATH.join(httpResponse.url.pathname, "/index.html");
			};
			httpResponse.location = PATH.resolve(PATH.normalize(PATH.join(wwwroot, httpResponse.url.pathname)));
			if (!inRoot(httpResponse.location)) {
				console.log("Request rejected for resource: %s", httpResponse.location);
				return BadRequest(request, response, 403, "Directory Traversal attempt has been logged.");
			};
			for(var str in httpResponse.url.query) // fix null prototype that URL.parse returns
				httpResponse.queryStrings[str] = httpResponse.url.query[str];

			console.log("%s HTTP/%s request from %s\nrequested pathname: %s\nserving resolved path: %s\n%o", 
						request.method, request.httpVersion, fromString, httpResponse.url.pathname, httpResponse.location, request.headers);
			switch(request.method.toUpperCase()) {
				case 'POST': {
					Post(request, response, httpResponse);
					break;
				}
				case 'GET': {
					Get(request, response, httpResponse);
					break;
				}
				case 'HEAD': {
					Head(request, response, httpResponse);
					break;
				}
				case 'PUT':
				case 'DELETE':
				case 'PATCH':
				case 'OPTIONS':
				case 'CONNECT':
				case 'TRACE':
				default: {
					BadRequest(request, response, 500, `Illegal ${request.method} request has been logged.`);
					break;
				}
			}
		}
		catch(e) {
			console.log("fatal error in HttpRequest(): ", e);
			return HttpCancelSocket(response);
		}
	}
	var WebServerStates = {
		lastHttpRequestLogTime: new Date().getTime()
	};
	var wwwroot = process.cwd();
	var hostname = null;
	var sslEnabled = false;
	var port = 8888;
	var sslPort = 8889;
	var keyPath = null;
	var certPath = null;
	var opts = { timeout: 10000, requestTimeout: 1000, headersTimeout: 1000, key: null, cert: null};
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
					console.log("set hostname to: %s", hostname);
					break;
				}
				case "-wwwroot": {
					if (i+1 < process.argv.length)
						wwwroot = process.argv[i+1];
					console.log("set wwwroot to: %s", hostname);
					break;
				}
				case "-h":
				case "-help": {
					console.log("You have been helped.");
					console.log("example cli usage:\twebserver -port 8888 -hostname mywebsite.com\n \
								\t-p, -port [8888]:\t\tset the port the webserver will use for http connections\n \
								\t-sp, -sport [8889]:\t\tset the port the webserver will use for https connections\n \
								\t-ssl:\t\tstart https webserver, requires -key and -cert to be set\n \
								\t-key [/path/to/key.key]:\t\tpath to ssl key file\n \
								\t-cert [/path/to/cert.cert]:\t\tpath to ssl cert file\n \
								\t-hostname [mywebsite.com]:\t\twebserver will only accept connections with a matching host header\n \
								\t-wwwroot [/my/path]:\t\toverrides default current working directory\n \
								\t-h, -help:\t\tunknown command\n");
					return;
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
		console.log("webserverjs (ssl): listening on port %i", sslPort);
	}

})();