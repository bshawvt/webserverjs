(() => {
	var HTTPS = require("https");
	var HTTP = require("http");
	var FS = require("fs");
	var PATH = require("path");
	var URL = require("url");

	var {Parse} = require("./parse.js");
	
	var states = [];

	function GetContentType(str) {
		var s = str.split(/[.]/g);
		switch (s[s.length - 1]) {
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
			case "bin": {
				return "application/octet-stream";
			}
			case "html":
			case "htm":
			default: {
				return "text/html"; //"text/plain";
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
						_fnDone(PATH.resolve(_file), {text: content, raw: buffer}, 200);
						FS.close(fd, function(err) {
							if (err !== null) return;//console.log(`- OpenFile request failed to close file -\n\t${_file}\n`);
						});
					});
				});
			});
		})(file, encoding, fnDone, fnError);
	};

	function GetQuery(request, fnDone) {
		var queryString = [];		
		request.setEncoding('utf8');
		fnDone = fnDone || (() => {});
		switch (request.method.toUpperCase()) {
			case 'DELETE':
			case 'POST':
			case 'PUT': {
				var blob = [];
				request.on("data", function(data) {
					blob[blob.length] = data;
				});
				request.on("end", function(data) {
					var url = URL.parse(blob.toString(), true);//.query
					for(var str in url.query) // fix null prototype that URL.parse returns
						queryString[str] = url.query[str];
					return fnDone(queryString);
				});
				break;
			}
			case 'GET':
			case 'HEAD':
			default: {
				var url = URL.parse(request.url, true);//.query
				console.log("omg! ", url);
				for(var str in url.query) // fix null prototype that URL.parse returns
					queryString[str] = url.query[str];
				return fnDone(queryString);
			}
		}
	}
	function ApiError(request, response) {
		console.log("todo: ApiError");
	}
	function ApiReply(request, response, status, data) {
		try {
			var result = data;
			if (typeof data != 'string')
				result = JSON.stringify(data);
			response.writeHead(status, {
				"Content-Length": result.length,
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": request.headers["origin"],
				"Access-Control-Allow-Methods": "*",
				"Access-Control-Allow-Headers": "Accept, Content-Type, X-Requested-With"
			});
			response.write(result);
			response.end();
		}
		catch(e) {
			console.trace(e);
		}
	}
	function UserController(request, response, queryString) {
		if (queryString["action"]) {
			var action = queryString["action"].toLowerCase();
			switch(action) {
				case 'get': {
					if (!(queryString["filename"]))
						return ApiReply(request, response, 400, {error: "bad request"});

					var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), queryString["filename"])));
					OpenFile(filename, "utf8", function(file, data, status) {
						if (status == 404) {
							ApiReply(request, response, status, {error: "file not found"});
						}
						else if (status == 200) {
							ApiReply(request, response, status, data.text);
						}
					});
					break;
				}
				
				case 'add': {
					
					if (!(queryString["filename"] && queryString["url"]))
						return ApiReply(request, response, 400, {error: "bad request"});
					
					var fUrl = queryString["url"];
					var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), queryString["filename"])));
					
					OpenFile(filename, "utf8", function(file, data, status) {
						if (status == 404) {
							ApiReply(request, response, status, {error: "file not found"});
						}
						else if (status == 200) {
							try {
								var json = JSON.parse(data.text);
								var d = new Date();
								json.contents.push({id: json.contents.length, clicks: 0, url: fUrl, date: `${d.getDate()}/${d.getMonth()}/${d.getFullYear()}`});
								//SaveFile(file, encoding, data, fnDone) {
								SaveFile(filename, "utf8", JSON.stringify(json), function(fn, success, error) {
									if (!success)
										console.log("something bad happened");
								});
							}
							catch(e) {
								console.trace(e);
							}
							//ApiReply(request, response, status, data.text);
						}
					});
					break;
				}
				case 'update': {
					break;
				}
				case 'delete': {
					var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), queryString["filename"])));
					OpenFile(filename, "utf8", function(file, data, status) {
						if (status == 404) {
							ApiReply(request, response, status, {error: "file not found"});
						}
						else if (status == 200) {
							//ApiReply(request, response, status, data.text);
						}
					});
					break;
				}
				default: {
					break;
				}
				break;
			}
		}
	};
	
	/*  */
	function Api(request, response) {
		console.log("api request..");
		GetQuery(request, function(queryString) {
			console.log("api queryString: ", queryString);
			/*try {*/
			var message = {};
			var controller = queryString["controller"];
			var action = queryString["action"];
			if (controller && action) {
				if (controller.toLowerCase() == "user") {
					new UserController(request, response, queryString);
				}
			}
		});
	};

	/*  */
	function Put(request, response) {
		//type = "text/html";
		response.writeHead(status, {"Content-Length": Buffer.byteLength(content), "Content-Type": type});
		response.write(content);
		response.end();
	};

	/*  */
	function Post(request, response) {
		
		var chunk = [];
		request.on("data", function(data) {
			chunk[chunk.length] = data;
		});

		request.on("end", function() {
			chunk = chunk.join('');
			var type = request.headers["content-type"];
			var headers = {"Content-Type": "text/html"};
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
					chunk = "<!DOCTYPE html><html><head></head><body><h1>Error 500</h1><p>Internal Server Error</p><div>File upload unsupported</div></body></html>"
					break; 
				}
			};
			response.writeHead(status, headers);
			if (type != "application/x-www-form-urlencoded") // todo ? write stuff or redirect
				response.write(chunk.toString());
			response.end();
		});
	};

	/*  */
	function Get(request, response) {
		var queryStrings = [];
		var url = URL.parse(request.url, true);//.query
		for(var str in url.query) // fix null prototype that URL.parse returns
			queryStrings[str] = url.query[str];
		var filename = PATH.resolve(PATH.normalize(PATH.join(process.cwd(), url.pathname)));
		console.log("serving: %s", filename);
		OpenFile(filename, 'utf8', function(filepath, contents, status) {
			filepath = filepath || "";
			//var splits = filepath.split(/[.]/g);
			var type = "text/html";
			var content = "<!DOCTYPE html><html><head></head><body><h1>Error 500</h1><p>Internal Server Error</p></body></html>";
			if (status == 200) {// && splits.length > 1) {
				content = contents.text;
				//var vl = splits[splits.length - 1].toLowerCase();
				type = GetContentType(filename);
			}
			else if (status == 404) {
				content = "<!DOCTYPE html><html><head></head><body><h1>Error 404</h1><p>File Not Found</p></body></html>";
			}
			response.writeHead(status, {"Content-Length": Buffer.byteLength(content), "Content-Type": type});
			response.write(content);
			response.end();
		});
	}

	/*  */
	function BadRequest(request, response, details) {
		var content = `<!DOCTYPE html><html><head></head><body><h1>Error 500</h1><p>Internal Server Error</p><div>${details}</div></body></html>`;
		response.writeHead(500, {"Content-Length": Buffer.byteLength(content), "Content-Type": "text/html"});
		response.write(content);
		response.end();
	}
	
	var sslEnabled = false;
	var port = 8888;
	var sslPort = 444;
	var keyPath = "";
	var certPath = "";
	var opts = {key: "", cert: ""};
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
				default: {
					break;
				}
			};
		}
	}
	/*  */
	function HttpRequest(request, response) {
		console.log("%s request from %s", request.method, request.connection.remoteAddress);
		if (request.url.length == 0 || request.url.length == 1)
			request.url = "/index.html";
		var subdomain = "";
		if (request.headers.host)
			subdomain = request.headers.host.split(/[.]/g)[0] || "";
		if (subdomain.toLowerCase() == "api")
			return Api(request, response);
		switch(request.method.toUpperCase()) {
			case 'POST': {
				Post(request, response);
				break;
			}
			case 'GET': {
				Get(request, response);
				break;
			}
			case 'PUT':
			case 'HEAD':
			case 'DELETE':
			case 'PATCH':
			case 'OPTIONS':
			case 'CONNECT':
			case 'TRACE':
			default: {
				BadRequest(request, response, `${request.method} requests are currently unhandled.`);
				break;
			}
		}
	}
	var server = HTTP.createServer(HttpRequest);
	server.listen(port);
	
	if (sslEnabled) {
		opts.key = FS.readFileSync(keyPath);
		opts.cert = FS.readFileSync(certPath);
		var sslServer = HTTPS.createServer(opts, HttpRequest);
		sslServer.listen(sslPort);
	}

})();