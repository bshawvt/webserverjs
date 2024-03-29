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
		var split = str.split(/[.]/g);
		var ext = null//split[split.length - 1];
		if (split.length > 0) 
			ext = split[split.length - 1];
		//var ext = str.substring(str.indexOf("."), str.length);
		
		//switch (s[s.length - 1]) {
		//{type: , encoding: "utf8" };
		switch(ext) {
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
			case "zip" :{
				return "application/zip";
			}
			//case "tar.gz": {
			case "tar":
			case "gz": {
				return "applicationh/gzip";
				//return "application/x-tar";
			}
			case "bin": {
				return "application/octet-stream";
			}
			default: {
				return "text/plain";
			}
		};
	};
	function OpenFile(file, encoding, fnDone) {
		((_file, _encoding, _fnDone) => {
			_fnDone = _fnDone || (() => {});
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
		})(file, encoding, fnDone);
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

	function GetStream(request, response, httpResponse) {
		var type = GetContentType(".html");
		FS.open(httpResponse.location, 'r', function(err, fd) {
			if(err !== null)
				return BadRequest(request, response, 404);
			FS.fstat(fd, function(err, stats) {
				try {
					if (err !== null) 
						return BadRequest(request, response, 404);
					var stream = FS.createReadStream("", {fd: fd, encoding: null, highWaterMark: rate });
					response.writeHead(200, {"Content-Length": stats.size, "Content-Type": httpResponse.contentType});
					stream.on("error", function(error) {
						return BadRequest(request, response, 404);
					});
					stream.on("close", function() {
						FS.close(fd, function(err) {
							if (err !== null) return;
						});
					});
					stream.on("end", function() {
						return response.end();
					});
					stream.on("data", function(chunk) {
						response.write(chunk);
						stream.pause();
						var timer = setTimeout(function() {
							clearTimeout(timer);
							stream.resume();
						}, 100);
					});
				}
				catch(e) {
					console.log("fatal error in StreamGet().fstat(): ", e);
					FS.close(fd, function(err) {
						if (err !== null) return;
					});
					return HttpCancelSocket(response);
				};
			});
		});
	};
	function ProcessDocument(httpResponse, chunks) {
		//console.log(httpRequest);
		//httpResponse.env.set("GENERATED_TIME", new Date().getTime() - httpResponse.requestStartTime);
		var buffer = Buffer.from(chunks);
		var start = 0;
		var end = 0;
		var chunkParse = [];
		for(var i = 0; i < chunks.length; i++) {
			if ((chunkParse.length == 0 && chunks[i] == 60)	// <
			|| (chunkParse.length == 1 && chunks[i] == 33)	// !
			|| (chunkParse.length == 2 && chunks[i] == 45)	// -
			|| (chunkParse.length == 3 && chunks[i] == 45)	// -
			|| (chunkParse.length == 4 && chunks[i] == 35)){// #
				chunkParse.push(String.fromCharCode(chunks[i]));
				if (chunkParse.length == 1) {
					start = i;
				};
			}
			else if (chunkParse.length >= 5) {
				chunkParse.push(String.fromCharCode(chunks[i]));
				if (chunkParse.length >= 9) { // min length of a valid statement
					var identity = [chunkParse[5], chunkParse[6], chunkParse[7], chunkParse[8]].join("");
					if (identity !== "echo") {// && identity !== "blip") {
						chunkParse = [];
						start = 0;
						end = 0;
						continue;
					};
				}
				if (chunkParse[chunkParse.length - 4]	 == " "	// space
					&& chunkParse[chunkParse.length - 3] == "-"	// -
					&& chunkParse[chunkParse.length - 2] == "-"	// -
					&& chunks[i] == 62) {						// >
					end = i+1;
					var foundString = chunkParse.join("");
					var type = foundString.substring(foundString.indexOf("#")+1, foundString.indexOf(" "));
					var params = { name: null, value: null };
					
					if (type == "echo") {
						var paramSet = foundString.substring(foundString.indexOf(" ")+1, foundString.indexOf(" -->"));
						var paramSplit = paramSet.split("=");
						if (paramSplit.length == 2) {
							params.name = paramSplit[0];
							try {
								params.value = JSON.parse(paramSplit[1]);
							}
							catch(e) {
								params.value = paramSet;
							};
						}
						if (params.name == "var") { // environment variable
							if (params.value != null) {
								httpResponse.env.set("GENERATED_TIME", new Date().getTime() - httpResponse.requestStartTime);
								var item = httpResponse.env.get(params.value);
								if (item != undefined) {
									buffer = Buffer.concat([buffer.subarray(0, start), Buffer.from(new String(item)), buffer.subarray(end, buffer.length)]);
									return ProcessDocument(httpResponse, buffer);
								};
							};
						}
						else { // probably just an echo
							buffer = Buffer.concat([buffer.subarray(0, start), Buffer.from(paramSet), buffer.subarray(end, buffer.length)]);
							return ProcessDocument(httpResponse, buffer);
						};
					}
					/*else if (type == "blip") {
						buffer = Buffer.concat([buffer.subarray(0, start), Buffer.from("BLAP"), buffer.subarray(end, buffer.length)]);
						return ProcessDocument(httpResponse, buffer);
					};*/
					chunkParse = [];
					start = 0;
					end = 0;
				};
			}
			else { // the delimiter set is invalid
				chunkParse = [];
				start = 0;
				end = 0;
			}
		};
		return buffer;
	};
	function FindInclude(currentFile, chunk) {
		var chunkParse = [];
		var start = 0;
		var end = 0;
		for(var i = 0; i < chunk.length; i++) {
			if ((chunkParse.length == 0 && chunk[i] == 60)	// <
			|| (chunkParse.length == 1 && chunk[i] == 33)	// !
			|| (chunkParse.length == 2 && chunk[i] == 45)	// -
			|| (chunkParse.length == 3 && chunk[i] == 45)	// -
			|| (chunkParse.length == 4 && chunk[i] == 35)	// #
			|| (chunkParse.length == 5 && chunk[i] == 105)	// i
			|| (chunkParse.length == 6 && chunk[i] == 110)	// n
			|| (chunkParse.length == 7 && chunk[i] == 99) 	// c
			|| (chunkParse.length == 8 && chunk[i] == 108)	// l
			|| (chunkParse.length == 9 && chunk[i] == 117)	// u
			|| (chunkParse.length == 10 && chunk[i] == 100)	// d
			|| (chunkParse.length == 11 && chunk[i] == 101)	// e
			|| (chunkParse.length == 12 && chunk[i] == 32)){// space 
				chunkParse.push(String.fromCharCode(chunk[i]));
				if (chunkParse.length == 1) {
					start = i;
				};
			}
			else if (chunkParse.length >= 13) {
				chunkParse.push(String.fromCharCode(chunk[i]));
				if (chunkParse[chunkParse.length - 4]	 == " "	// space
					&& chunkParse[chunkParse.length - 3] == "-"	// -
					&& chunkParse[chunkParse.length - 2] == "-"	// -
					&& chunk[i] == 62) {						// >
					// whatever, found the end delimiter
					var chunkString = chunkParse.join("");
					var chunkEqualPosition = chunkString.indexOf("=");
					var chunkType = chunkString.substring(13, chunkEqualPosition);
					var chunkFilename = chunkString.substring(chunkEqualPosition+2, chunkString.indexOf(" -->") - 1);
					end = i+1;

					var includeFile = null;
					if (chunkType == "file")
						includeFile = PATH.resolve(PATH.normalize(PATH.join(currentFile, "../", chunkFilename)));
					else if (chunkType == "virtual")
						includeFile = PATH.resolve(PATH.normalize(PATH.join(wwwroot, chunkFilename)));
					//console.log("resolved: %s", includeFile);
					if (inRoot(includeFile)) {
						return {start: start, end: end, include: includeFile};
					};
					// reset state for more potential includes
					// todo: not used anymore
					chunkParse = [];
					start = 0;
					end = 0;
				}
			}
			else { // the delimiter set is invalid
				chunkParse = [];
				start = 0;
				end = 0;
			}
		};
		return null;
	};
	function StreamContents(filename, onDone) {
		FS.open(filename, 'r', function(err, fd) {
			if(err !== null) {
				return onDone(null, -1);
			}
			//FS.fstat(fd, function(err, stats) {
			try {
				var chunkBuffer = [];
				if (err !== null) {
					return onDone(null, -1);
				}
				var stream = FS.createReadStream("", {fd: fd, encoding: null, highWaterMark: rate });
				stream.on("error", function(error) {
					return onDone(null, -1);
				});
				stream.on("close", function() {
					//FS.close(fd, function(err) {
					//	console.log("done");
					//	if (err !== null) {
					//		console.log("4", err);
					//		return;
					//	}
					//});
				});
				stream.on("end", function() {
					return onDone(Buffer.concat(chunkBuffer), chunkBuffer.length);
				});
				stream.on("data", function(chunk) {
					chunkBuffer.push(chunk);//Buffer.concat([chunkBuffer, chunk]);
				});
			}
			catch(e) {
				console.log("fatal error in StreamFile().fstat(): ", e);
				FS.close(fd, function(err) {
					if (err !== null) return onDone(null, -1);
				});
				return;
			};
		});
		//});
	};
	function Get(request, response, httpResponse) {
		try {
			if (httpResponse.contentType == GetContentType(".html")) { 
				// todo
				(() => {
					function onProcessingComplete(buffer) {
						//console.log(buffer.toString("utf8", 0));
						response.writeHead(200, {"Content-Length":buffer.length,"Content-Type": GetContentType(httpResponse.location)});
						response.write(buffer);
						response.end();
					};
					function StreamMixer(buffer, rootFile, onDone) {
						buffer = ProcessDocument(httpResponse, buffer);
						var found = FindInclude(rootFile, buffer);
						if (found != null) {
							((_item, _buffer) => {
								StreamContents(_item.include, function(nextBuffer, nextSize) {
									var centerBuffer = nextBuffer;
									if (nextSize == -1) {
										centerBuffer = Error(404);
									}
									startBuffer = _buffer.subarray(0, _item.start);
									endBuffer = buffer.subarray(_item.end, buffer.length);
									buffer = Buffer.concat([startBuffer, centerBuffer, endBuffer]);
									StreamMixer(buffer, rootFile, onDone);
								});
							})(found, buffer);
						}
						else {
							onDone(buffer);
						};
					};
					StreamContents(httpResponse.location, function(buffer, size) {
						if (size == -1)
							return BadRequest(request, response, 404);
						StreamMixer(buffer, httpResponse.location, onProcessingComplete);
					});
				
				})();
			}
			else {
				return GetStream(request, response, httpResponse);
			};
		}
		catch(e) {
			console.log("fatal error in Get():", e);
			return HttpCancelSocket(response);
		};
		
	};
	function Head(request, response, httpResponse) {
		try {			
			(() => {
			
				function onProcessingComplete(buffer) {
					response.writeHead(200, {"Content-Length":buffer.length,"Content-Type": GetContentType(httpResponse.location)});
					//response.write(buffer);
					response.end();
				};
				function StreamMixer(buffer, rootFile, onDone) {
					buffer = ProcessDocument(httpResponse, buffer);
					var found = FindInclude(rootFile, buffer);
					if (found != null) {
						((_item, _buffer) => {
							StreamContents(_item.include, function(nextBuffer, nextSize) {
								var centerBuffer = nextBuffer;
								if (nextSize == -1) {
									centerBuffer = Error(404);
								}
								startBuffer = _buffer.subarray(0, _item.start);
								endBuffer = buffer.subarray(_item.end, buffer.length);
								buffer = Buffer.concat([startBuffer, centerBuffer, endBuffer]);
								StreamMixer(buffer, rootFile, onDone);
							});
						})(found, buffer);
					}
					else {
						onDone(buffer);
					};
				};
				StreamContents(httpResponse.location, function(buffer, size) {
					if (size == -1)
						return BadRequest(request, response, 404);
					StreamMixer(buffer, httpResponse.location, onProcessingComplete);
				});
				
			})();
		}
		catch(e) {
			console.log("fatal error in Head(): ", e);
			return HttpCancelSocket(response);
		}
	};

	/*  */
	function BadRequest(request, response, code, details) {
		try {
			var content = Error(code, details);
			var remoteAddress = request.headers["x-forwarded-for"];
			var fromAddress = request.connection.remoteAddress;
			var fromString = remoteAddress ? `${remoteAddress}(${fromAddress})` : fromAddress;
			console.log("Rejected %s HTTP/%s request from %s\nError %s: %s\n",
						request.method, request.httpVersion, fromString, code, details || "");
			response.writeHead(code, {"Content-Length": Buffer.byteLength(content), 
									  "Content-Type": GetContentType(".html")});
			response.write(content);
			return response.end();
		}
		catch(e) {
			console.log("fatal error in BadRequest(): ", e);
			return HttpCancelSocket(response);
		};
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
			};
			var httpResponse = {
				url: URL.parse(request.url, true),
				location: null,
				contentType: GetContentType(".html"),
				requestStartTime: new Date().getTime(),
				env: new Map()
			};
			if (httpResponse.url.pathname[httpResponse.url.pathname.length - 1] == "/") { // if end of pathname is / then append index.html
				httpResponse.url.pathname = PATH.join(httpResponse.url.pathname, "/index.html");
			};
			httpResponse.location = PATH.resolve(PATH.normalize(PATH.join(wwwroot, httpResponse.url.pathname)));
			if (!inRoot(httpResponse.location)) {
				console.log("Request rejected for resource: %s", httpResponse.location);
				return BadRequest(request, response, 403, "Directory Traversal attempt has been logged.");
			};
			if (!noHeaderSpam) {
				console.log("%s HTTP/%s request from %s\nrequested pathname: %s\nserving resolved path: %s\n%o", 
						request.method, request.httpVersion, fromString, httpResponse.url.pathname, httpResponse.location, request.headers);
			};
			httpResponse.contentType = GetContentType(httpResponse.location);
			httpResponse.env.set("REMOTE_IP", remoteAddress || fromAddress);
			httpResponse.env.set("GENERATED_TIME", 0);
			httpResponse.env.set("DATE", new Date(httpResponse.requestStartTime));
			
			switch(request.method.toUpperCase()) {
				case 'POST': {
					return Post(request, response, httpResponse);
				}
				case 'GET': {
					return Get(request, response, httpResponse);
				}
				case 'HEAD': {
					return Head(request, response, httpResponse);
				}
				case 'PUT':
				case 'DELETE':
				case 'PATCH':
				case 'OPTIONS':
				case 'CONNECT':
				case 'TRACE':
				default: {
					return BadRequest(request, response, 500, `Illegal ${request.method} request has been logged.`);
				}
			}
		}
		catch(e) {
			console.log("fatal error in HttpRequest(): ", e);
			return HttpCancelSocket(response);
		}
	}

	var wwwroot = process.cwd();
	var rate = 65536;
	var noHeaderSpam = false;
	var hostname = null;
	var sslEnabled = false;
	var port = 8888;
	var sslPort = 8889;
	var keyPath = null;
	var certPath = null;
	var opts = { timeout: 10000, requestTimeout: 5000, headersTimeout: 5000, key: null, cert: null};
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
				case "-rate": {
					if (i+1 < process.argv.length)
						rate = parseInt(process.argv[i+1]);
					console.log("set rate to: %s", rate);
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
								\t-rate [1000]:\t\tdata transfer rate in bytes per 100ms\n \
								\t-nhs, -noheaderspam:\t\twhen toggled, header spam will be skipped\n \
								\t-h, -help:\t\tunknown command\n");
					return;
				}
				case "-nhs":
				case "-noheaderspam": {
					console.log("set no header spam to true");
					noHeaderSpam = true;
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
		console.log("webserverjs (ssl): listening on port %i", sslPort);
	}

})();