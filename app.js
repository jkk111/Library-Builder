var app = require("express")();
app.use(require("./index.js")({maxAge: 60 * 1000}));
app.listen(80);