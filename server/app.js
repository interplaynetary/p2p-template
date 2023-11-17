const express = require("express");
const path = require("path");
const Gun = require("gun");
const chokidar = require("chokidar");
const app = express();
const fs = require("fs");
const unserialize = require("locutus/php/var/unserialize");

if (process.env.CACHE_DIR) {
  console.log("Watching " + process.env.CACHE_DIR + " for changes.");
  chokidar.watch(process.env.CACHE_DIR).on("all", (event, path) => {
    if (event == "add" || event == "change") {
      // Feeds end in .spc
      if (path.endsWith(".spc")) {
        fs.readFile(path, "utf8", (err, data) => {
          if (err) {
            console.log(err);
          }
          else {
            // Need to be able to search data for specific keys.
            console.log(unserialize(data));
          }
        });
      }
      // Images end in .spi
      else if (path.endsWith(".spi")) {
        console.log(path + " is an image");
      }
    }
  });
}

app.use(express.static(path.join(__dirname, "../browser/build")));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "../browser/build", "index.html"));
});

app.listen(3000);

app.use(Gun.serve);

const server = app.listen(8765, () => {
  console.log("Gun listening on port 8765");
})

Gun({web: server, axe: false, secure: true});
