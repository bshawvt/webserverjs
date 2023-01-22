var net = require("net");

var client = new net.Socket();
client.connect({host: "localhost", port: 8888}, function(a, b, c) {
	console.log(1, b, c);
});

client.on("connect", function(a, b, c) {
	console.log("on connect:", a, b, c);
});
client.on("close", function(a, b, c) {
	console.log("on close:", a, b, c);
});
client.on("data", function(a, b, c) {
	console.log("on data:", a.toString("utf8", 0, a.length - 1), b, c);
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
	var headers = [`GET ${url} HTTP/1.1`, "Host: test", "\r\n"].join("\r\n");
	client.write(headers);
});