var app = require("express")();
app.use();
var buildLibrary = require("./index.js")();
app.listen(80);
app.get("/lib/:root", function(req, res, next) {
  var libRoot = req.params.root;
  buildLibrary(libRoot, function(err, result) {
    if(err) return res.status(500).send("Error generating library!");
    res.send(result);
  })
});