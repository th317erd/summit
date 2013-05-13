/* 	exmaple.js
	SummIT.js example file
	Copyright Wyatt Greenway 2013
*/

if (global.Σ === undefined) Σ = require("./summit");

Σ.run(function() {
	var http = Σ.require("http");
	var server = http.createServer(function(request, response) {
		console.log("Got a transmission request!: ", request.url);

		var fs = Σ.require("fs");

		fs.on("exception", function(err) {
			response.writeHead(500, {"Content-Type": "text/html"});
			response.write("We had a problem Spock!");
			response.end();
			delete fs;
		});

		fs.readFile("Uhura.txt", function (err, data) {
			if (err) {
				throw "Transmission failed sir!";
			}

			response.writeHead(200, {"Content-Type": "text/html"});
			response.write("Transmission successful sir!");
			response.end();
		});
	});
	server.listen(8082);
	console.log("HTTP server started on port 8082");
});
