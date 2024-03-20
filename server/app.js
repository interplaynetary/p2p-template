const express = require("express")
const path = require("path")
const Gun = require("gun")
const app = express()
const bodyParser = require("body-parser")
const gun = Gun({
  web: app.listen(8765),
  multicast: false,
  axe: false,
  secure: true,
})
const user = gun.user()
const alias = process.env.GUN_USER_ALIAS ?? "alias"
const pass = process.env.GUN_USER_PASS ?? "passphrase"

// hostPublicKey is requested by the browser, so that it knows where to get
// data from in gun (since all data must be stored under a user's account).
var hostPublicKey = ""
// lastSaved is the timestamp of the last time save was called. This allows
// slowing calls to save so that the timestamp can be used as a unique key.
var lastSaved = 0

user.auth(alias, pass, auth)

app.use(Gun.serve)
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, "../browser/build")))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../browser/build", "index.html"))
})

app.get("/host-public-key", (req, res) => {
  if (hostPublicKey === "") {
    res.status(404).send("Host public key not found.")
  } else {
    res.send(hostPublicKey)
  }
})

app.post("/", (req, res) => {
  // limit and wait times are in milliseconds.
  var limit = 10
  var wait = 0

  if (lastSaved !== 0) {
    let elapsed = Date.now() - lastSaved
    if (elapsed < limit) {
      wait = limit - elapsed
      console.log("Waiting ", wait, "ms before save.")
    }
  }
  setTimeout(() => {
    save(req.body)
    res.end()
  }, wait)
})

app.listen(3000)

function auth(ack) {
  if (!ack.err) {
    hostPublicKey = ack.get
    console.log(alias + " logged in")
    return
  }

  console.log("Creating account for " + alias)
  user.create(alias, pass, ack => {
    if (ack.err) {
      console.log(ack.err)
      return
    }

    user.auth(alias, pass, ack => {
      if (ack.err) {
        console.log(ack.err)
        return
      }

      hostPublicKey = ack.get
      console.log(alias + " logged in")
    })
  })
}

function save(data) {
  lastSaved = Date.now()
  user.get("public").get("items").get(lastSaved).put({
    name: data.name,
    message: data.message,
  })
}
