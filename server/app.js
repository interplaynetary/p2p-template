const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const Gun = require("gun")
require("gun/sea")
require("gun/lib/unset.js")

const app = express()
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

console.log("Trying auth credentials for " + alias)
user.auth(alias, pass, auth)

app.use(Gun.serve)
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, "../browser/build")))

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../browser/build", "index.html"))
})

app.get("/host-public-key", (req, res) => {
  if (hostPublicKey === "") {
    res.status(404).send("Host public key not found")
  } else {
    res.send(hostPublicKey)
  }
})

app.post("/check-invite-code", (req, res) => {
  var found = false
  var code = req.body.code || "admin"
  user.get("public").get("invite_codes").get(code).once(used => {
    if (used) {
      res.status(400).send("Invite code already used")
      return
    }

    user.get("private").get("invite_codes").map().once(enc => {
      if (!found) {
        Gun.SEA.decrypt(enc, user._.sea, check => {
          if (check === code) {
            found = true
            res.end()
          }
        })
      }
    })
  })
  setTimeout(() => {
    if (!found) {
      res.status(404).send("Invite code not found")
    }
  }, 10000)
})

app.post("/claim-invite-code", (req, res) => {
  var found = false
  var code = req.body.code || "admin"
  user.get("private").get("invite_codes").map().once(enc => {
    if (!found) {
      Gun.SEA.decrypt(enc, user._.sea, check => {
        if (check === code) {
          found = true
          user.get("public").get("invite_codes").get(code).put(req.body.pub)
          user.get("private").get("invite_codes").unset(enc)
          res.end()
        }
      })
    }
  })
  setTimeout(() => {
    if (!found) {
      res.status(404).send("Invite code not found")
    }
  }, 10000)
})

app.post("/feed", (req, res) => {
  saveFeed(req.body)
  res.end()
})

app.post("/item", (req, res) => {
  // limit and wait times are in milliseconds.
  var limit = 10
  var wait = 0

  if (lastSaved !== 0) {
    let elapsed = Date.now() - lastSaved
    if (elapsed < limit) {
      wait = limit - elapsed
      console.log("Waiting ", wait, "ms before save")
    }
  }
  setTimeout(() => {
    saveItem(req.body)
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

  console.log("No auth - creating an account for " + alias)
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
      console.log("Creating admin invite code")
      Gun.SEA.encrypt("admin", user._.sea, enc => {
        user.get("private").get("invite_codes").set(enc)
      })
    })
  })
}

function saveFeed(data) {
  user.get("public").get("feeds").get(data.xml_url).put({
    description: data.description ?? "",
    html_url: data.html_url ?? "",
    language: data.language ?? "",
    title: data.title ?? "",
    image_url: data.image_url ?? "",
    image_title: data.image_title ?? "",
    image_link: data.image_link ?? "",
  })
}

function saveItem(data) {
  lastSaved = Date.now()
  user.get("public").get("items").get(lastSaved).put({
    title: data.title ?? "",
    content: data.content ?? "",
    author: data.author ?? "",
    category: data.category ?? "",
    enclosure: data.enclosure ?? "",
    permalink: data.permalink ?? "",
    guid: data.guid ?? "",
    timestamp: data.timestamp ?? "",
    xml_url: data.xml_url ?? "",
  })
}
