var net = require("net");

var client = new net.Socket();
client.connect({host: "localhost", port: 8888}, function(a1, b1, c1) {
	/*console.log(a1, b1, c1);
	client.write("test", "UTF8", function(a2, b2, c2) {
		console.log(a2, b2, c2);
	});*/
});

client.on("connect", function(a, b, c) {
	console.log("on connect:", a, b, c);
});
client.on("close", function(a, b, c) {
	console.log("on close:", a, b, c);
});
client.on("data", function(a, b, c) {
	console.log("on data:", a.toString("utf8", 0, a.length), b, c);
});
client.on("end", function(a, b, c) {
	console.log("on end:", a, b, c);
});
client.on("error", function(a, b, c) {
	console.log("on error:", a, b, c);
});
client.on("ready", function(a, b, c) {
	console.log("on ready:", a, b, c);
	var url = "/index.html";
	var msg = [`GET ${url} HTTP/1.1`, "Host: test", "\r\n"].join("\r\n");
	//client.write("GET /index.html HTTP/1.1\r\nHost:1\r\n\r\n");
	//console.log(msg);
	client.write(msg);
	//client.write("asda");
});