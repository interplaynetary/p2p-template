const express = require("express");
const path = require("path");
const Gun = require("gun");
const app = express();

console.log("NODE_ENV=" + process.env.NODE_ENV)

app.use(express.static(path.join(__dirname, "../browser/build")));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "../browser/build", "index.html"));
});

app.listen(3000);

app.use(Gun.serve);

const server = app.listen(8765, () => {
  console.log("Gun listening on port 8765");
})

Gun({web: server, axe:false});
