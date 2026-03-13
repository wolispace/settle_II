let http = require('http');
let https = require('https');
let fs = require('fs'); 
let express = require('express');

// const privateKey = fs.readFileSync('/etc/letsencrypt/live/jproj.xyz/privkey.pem', 'utf8');
// // x509 certificate
// const certificate = fs.readFileSync('/etc/letsencrypt/live/jproj.xyz/cert.pem', 'utf8');
// const ca = fs.readFileSync('/etc/letsencrypt/live/jproj.xyz/chain.pem', 'utf8');

// const options = {
// 	key: privateKey,
// 	cert: certificate,
// 	ca: ca
// };

const options = {
	pfx: fs.readFileSync('keys/localhost.pfx'),
	passphrase: 'yourpassword',
};

let app = express();

let cors = require('cors')

// if they ever use port 80 then tell them the permanent redirect location
http.createServer(function (req, res) {
	                                    // e.g.   website.com:8080      /about
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(80);

let httpsServer = https.createServer(options,app); 
httpsServer.listen(443);

app.use(cors());
app.use((req, res, next) => {
	res.setHeader('Cross-Origin-Opener-Policy',  'same-origin');
	res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
	next();
}); 

// console.log("here's how the self-signed key was generated")
// // cd D:\\simpleTest
// console.log(`cd D:\\simpleTest`);
// // $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(10)
// console.log(`$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\\LocalMachine\\My"`)
// // $pwd = ConvertTo-SecureString -String "yourpassword" -Force -AsPlainText
// console.log(`$pwd = ConvertTo-SecureString -String "yourpassword" -Force -AsPlainText`)
// // Export-PfxCertificate -Cert $cert -FilePath ".\localhost.pfx" -Password $pwd
// console.log(`Export-PfxCertificate -Cert $cert -FilePath "D:\\simpleTest\\localhost.pfx" -Password $pwd`)


// --------------------SIMPLE HELLO WORLD-------------------------

app.get('/', (req, res) => {
	res.send('Hello!');
});


// ---------------------ANYTHING IN THE PUBLIC FOLDER----------------

let path = __dirname + '/public';
// Use global wilcard route / used to serve static content, html assumed as default unless explicitly specified otherwise in the url
app.use('/',express.static(path,{extensions:['html']}));


// ----------------------CUSTOM ROUTES--------------------------------

// there's an example in this video for how to separate these into a separate folder to keep things modular
// https://youtu.be/muhJTRQ7WMk

app.get('/dog', (req, res) => {
	res.send('<img src="https://i.insider.com/5df126b679d7570ad2044f3e?width=1100&format=jpeg&auto=webp">');
});


// -----------------------RESPOND TO 404 ERRORS----------------------

app.use((req,res)=>{
	res.send(`<h1>it's the 404</h1>`)
});
