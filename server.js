let http = require('http');
let https = require('https');
let fs = require('fs');
let path = require('path');

const options = {
	pfx: fs.readFileSync('keys/localhost.pfx'),
	passphrase: 'yourpassword',
};

// HTTP server - redirect to HTTPS
http.createServer((req, res) => {
	res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
	res.end();
}).listen(80);

// HTTPS server
https.createServer(options, (req, res) => {
	// CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
	res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

	let url = req.url.split('?')[0];

	// Root route
	if (url === '/') {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end('Hello!');
		return;
	}

	// Custom /dog route
	if (url === '/dog') {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end('<img src="https://i.insider.com/5df126b679d7570ad2044f3e?width=1100&format=jpeg&auto=webp">');
		return;
	}

	// Serve static files from public folder
	let filePath = path.join(__dirname, 'public', url);
	if (!path.extname(filePath)) filePath += '.html';

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/html' });
			res.end(`<h1>it's the 404</h1>`);
			return;
		}

		let ext = path.extname(filePath);
		let contentType = {
			'.html': 'text/html',
			'.css': 'text/css',
			'.js': 'application/javascript',
			'.json': 'application/json',
			'.png': 'image/png',
			'.jpg': 'image/jpeg',
			'.gif': 'image/gif',
			'.svg': 'image/svg+xml'
		}[ext] || 'text/plain';

		res.writeHead(200, { 'Content-Type': contentType });
		res.end(data);
	});
}).listen(443);
