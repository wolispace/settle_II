::@echo off
echo Starting server and browser
:: open a web browser
:: start node in watch mode so it restarts if there are code changes

start "" https://localhost/index.html
start "" node --watch server.js

