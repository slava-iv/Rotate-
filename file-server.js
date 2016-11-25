// File server.

var express = require('express')
var multer = require('multer')
var form = "<!DOCTYPE HTML><html><body>" +
        "<form method='post' action='/upload' enctype='multipart/form-data'>" +
        "<input type='file' name='image'/>" +
        "<input type='submit' /></form>" +
        "</body></html>";

var app = express()

module.exports = function fileServer(port, fileCallback) {
    var upload = multer({ dest: 'uploads/' })

    app.get('/', function(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(form);
    });

    app.get('/upload', function(req, res) {
        res.redirect("/");
    });

    app.post('/upload', upload.single('image'), function(req, res, next) {
        console.log("received: " + req.file.path);
        fileCallback(req.file.path);
    });

    app.listen(8080);

    return app;
};
