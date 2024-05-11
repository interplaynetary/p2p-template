const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const nodemailer = require("nodemailer")
const Gun = require("gun")
require("gun/sea")

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

// lastSaved is the timestamp of the last time save was called. This allows
// slowing calls to save so that the timestamp can be used as a unique key.
var lastSaved = 0

// inviteCodes is a map of invite codes and their gun keys, stored in memory
// to avoid decrypting them in each of the endpoints they're required in.
const inviteCodes = new Map()

console.log("Trying auth credentials for " + alias)
user.auth(alias, pass, auth)

app.use(Gun.serve)
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, "../browser/build")))
app.use("/private", (req, res, next) => {
  const auth = (req.headers.authorization || "").split(" ")[1] || ""
  const [username, password] = Buffer.from(auth, "base64").toString().split(":")
  if (username === alias && password === pass) {
    next()
  } else {
    res.status(401).end()
  }
})

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../browser/build", "index.html"))
})

// The host public key is requested by the browser, so that it knows where to
// get data from (all data is stored under user accounts when using secure).
app.get("/host-public-key", (req, res) => {
  if (!user.is) {
    res.status(404).send("Host public key not found")
  } else {
    res.send(user.is.pub)
  }
})

app.get("/register", (req, res) => {
  res.redirect("/?redirect=register")
})

app.get("/login", (req, res) => {
  res.redirect("/?redirect=login")
})

app.get("/settings", (req, res) => {
  res.redirect("/?redirect=settings")
})

app.get("/validate-email", (req, res) => {
  res.redirect(`/?redirect=validate-email&code=${req.query.code}&validate=${req.query.validate}`)
})

app.get("/reset-password", (req, res) => {
  res.redirect("/?redirect=reset-password")
})

app.get("/update-password", (req, res) => {
  res.redirect(`/?redirect=update-password&username=${req.query.username}&code=${req.query.code}&reset=${req.query.reset}`)
})

app.post("/check-invite-code", (req, res) => {
  const code = req.body.code || "admin"
  if (inviteCodes.has(code)) {
    res.end() // ok
    return
  }

  // This just provides relevant errors.
  user.get("accounts").get(code).once(used => {
    if (used) {
      if (code === "admin") {
        res.status(400).send("Please provide an invite code")
        return
      }
      res.status(400).send("Invite code already used")
      return
    }
    res.status(404).send("Invite code not found")
  }, {wait: 0})
})

app.post("/claim-invite-code", async (req, res) => {
  const code = req.body.code || "admin"
  const invite = inviteCodes.get(code)
  if (!invite) {
    res.status(404).send("Invite code not found")
    return
  }
  if (!req.body.pub) {
    res.status(400).send("Public key required")
    return
  }
  if (!req.body.alias) {
    res.status(400).send("Username required")
    return
  }
  if (/\.\d$/.test(req.body.alias)) {
    res.status(400).send("Username must not end in . and a number")
    return
  }
  if (!req.body.email) {
    res.status(400).send("Email required")
    return
  }

  const validate = newCode()
  let encValidate = await Gun.SEA.encrypt(validate, user._.sea)
  let encEmail = await Gun.SEA.encrypt(req.body.email, user._.sea)
  user.get("accounts").get(code).put({
    pub: req.body.pub,
    alias: req.body.alias,
    name: req.body.alias,
    email: encEmail,
    validate: encValidate,
  })
  validateEmail(req.body.alias, req.body.email, code, validate)

  // Remove invite code as it's no longer available.
  user.get("available").get("invite_codes").get(invite.key).put(null)
  inviteCodes.delete(code)

  if (code === "admin") {
    res.end()
    return
  }

  // Also remove from shared codes of the invite owner.
  user.get("accounts").get(invite.owner).once(account => {
    if (!account) {
      console.log("Account not found for invite.owner!")
      return
    }

    gun.user(account.pub).get("epub").once(epub => {
      if (!epub) {
        res.status(404).send("User not found for public key")
        return
      }

      const owner = user.get("shared").get("invite_codes").get(invite.owner)
      owner.once(async codes => {
        const secret = await Gun.SEA.secret(epub, user._.sea)
        for (const [key, enc] of Object.entries(codes)) {
          if (!enc) continue

          let shared = await Gun.SEA.decrypt(enc, secret)
          if (code === shared) {
            owner.get(key).put(null)
            break
          }
        }
      }, {wait: 0})
    }, {wait: 0})
  }, {wait: 0})
  res.end()
})

app.post("/validate-email", (req, res) => {
  const code = req.body.code
  if (!code) {
    res.status(400).send("Invite code required")
    return
  }
  if (!req.body.validate) {
    res.status(400).send("Validation code required")
    return
  }

  user.get("accounts").get(code).once(async account => {
    if (!account) {
      res.status(404).send("Account not found")
      return
    }
    if (!account.validate) {
      res.send("Email already validated")
      return
    }

    let validate = await Gun.SEA.decrypt(account.validate, user._.sea)
    if (validate !== req.body.validate) {
      res.status(400).send("Validation code does not match")
      return
    }

    user.get("accounts").get(code).put({validate: null})
    res.send("Email validated")
  }, {wait: 0})
})

app.post("/reset-password", (req, res) => {
  if (!req.body.email) {
    res.status(400).send("Email required")
    return
  }

  const code = req.body.code || "admin"
  user.get("accounts").get(code).once(async account => {
    if (!account) {
      res.status(404).send("Account not found")
      return
    }

    let increment = 0
    let match = account.alias.match(/\.(\d)$/)
    if (match) {
      increment = Number(match[1])
    }
    if (increment === 9) {
      res.status(400).send("Too many password resets")
      return
    }

    let email = await Gun.SEA.decrypt(account.email, user._.sea)
    if (email !== req.body.email) {
      res.status(400).send("Email does not match invite code")
      return
    }
    if (account.validate) {
      res.status(400).send("Please validate your email first")
      return
    }

    const reset = newCode()
    let remaining = 8 - increment
    user.get("accounts").get(code).put({
      reset: await Gun.SEA.encrypt(reset, user._.sea),
      expiry: Date.now() + 86400000,
    })

    resetPassword(account.name, remaining, email, code, reset)
    res.send("Reset password email sent")
  }, {wait: 0})
})

app.post("/update-password", (req, res) => {
  const code = req.body.code
  if (!code) {
    res.status(400).send("Invite code required")
    return
  }
  if (!req.body.reset) {
    res.status(400).send("Reset code required")
    return
  }
  if (!req.body.pub) {
    res.status(400).send("Public key required")
    return
  }
  if (!req.body.alias) {
    res.status(400).send("Username required")
    return
  }
  if (!req.body.name) {
    res.status(400).send("Display Name required")
    return
  }

  user.get("accounts").get(code).once(async account => {
    if (!account) {
      res.status(404).send("Account not found")
      return
    }
    if (!account.reset) {
      res.status(404).send("Reset code not found")
      return
    }
    if (!account.expiry || account.expiry < Date.now()) {
      res.status(400).send("Reset code has expired")
      return
    }

    let reset = await Gun.SEA.decrypt(account.reset, user._.sea)
    if (reset !== req.body.reset) {
      res.status(400).send("Reset code does not match")
      return
    }

    user.get("accounts").get(code).put({
      pub: req.body.pub,
      alias: req.body.alias,
      name: req.body.name,
      prev: account.pub,
      email: account.email,
    })
    res.send(account.pub)
  }, {wait: 0})
})

app.post("/private/create-invite-codes", (req, res) => {
  const code = req.body.code
  if (!code) {
    res.status(400).send("Invite code required")
    return
  }

  user.get("accounts").get(code).once(account => {
    if (!account) {
      res.status(404).send("Account not found")
      return
    }
    if (account.validate) {
      res.status(400).send("Email not validated")
      return
    }

    gun.user(account.pub).get("epub").once(epub => {
      if (!epub) {
        res.status(404).send("User not found for public key")
        return
      }

      createInviteCodes(req.body.count || 1, code, epub)
      res.end()
    }, {wait: 0})
  }, {wait: 0})
})

app.post("/private/feed", (req, res) => {
  saveFeed(req.body)
  res.end()
})

app.post("/private/item", (req, res) => {
  // limit and wait times are in milliseconds.
  const limit = 10
  var wait = 0

  if (lastSaved !== 0) {
    let elapsed = Date.now() - lastSaved
    if (elapsed < limit) {
      wait = limit - elapsed
      console.log("Waiting " + wait + " ms before save")
    }
  }
  setTimeout(() => {
    saveItem(req.body)
    res.end()
  }, wait)
})

app.listen(3000)

function newCode() {
  const chars = "bcdfghjkmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ123456789"

  var code = ""
  while (code.length < 8) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function auth(ack) {
  if (!ack.err) {
    console.log(alias + " logged in")
    mapInviteCodes()
    return
  }

  console.log("No auth - creating an account for " + alias)
  user.create(alias, pass, ack => {
    if (ack.err) {
      console.log(ack.err)
      return
    }

    user.auth(alias, pass, async ack => {
      if (ack.err) {
        console.log(ack.err)
        return
      }

      console.log("Creating admin invite code")
      const enc = await Gun.SEA.encrypt({code: "admin"}, user._.sea)
      user.get("available").get("invite_codes").set(enc)
      mapInviteCodes()
    })
  })
}

function mapInviteCodes() {
  // map subscribes to invite_codes, so this will also be called when new
  // invite codes are created.
  user.get("available").get("invite_codes").map().once(async (enc, key) => {
    if (enc) {
      let invite = await Gun.SEA.decrypt(enc, user._.sea)
      if (!inviteCodes.has(invite.code)) {
        invite.key = key
        inviteCodes.set(invite.code, invite)
      }
    }
  })
}


function checkCodes() {
  // This function should post the list of new codes to all federated hosts
  // to make sure there are no duplicates between them. Put each of the
  // requests in a promise, and once all have been resolved tell each of them
  // that they should store the new codes and the associated owner's code.
  return true
}

async function createInviteCodes(count, owner, epub) {
  let i = 0
  let newCodes = []
  while (i < count) {
    let code = newCode()
    if (!inviteCodes.has(code)) {
      i++
      newCodes.push(code)
    }
  }
  if (!checkCodes(newCodes)) {
    // Just try again with new codes.
    createInviteCodes(count, owner, epub)
    return
  }

  const secret = await Gun.SEA.secret(epub, user._.sea)
  for (let i = 0; i < newCodes.length; i++) {
    let invite = {code: newCodes[i], owner: owner}
    let enc = await Gun.SEA.encrypt(invite, user._.sea)
    user.get("available").get("invite_codes").set(enc)
    let shared = await Gun.SEA.encrypt(newCodes[i], secret)
    user.get("shared").get("invite_codes").get(owner).set(shared)
  }
}

function resetPassword(name, remaining, email, code, reset) {
  const host = process.env.APP_HOST ?? "http://localhost:3000"
  const message = `Hello ${name}
You can now update your password at ${host}/update-password?username=${name}&code=${code}&reset=${reset}

This link will be valid to use for the next 24 hours.

${remaining <= 5 ? `Note that you can only reset your password ${remaining} more time${remaining != 1 ? "s" : ""}.` : ""}
`
  mail(email, "Update Password", message)
}

function validateEmail(name, email, code, validate) {
  const host = process.env.APP_HOST ?? "http://localhost:3000"
  const message = `Hello ${name}
Thanks for creating an account at ${host}

Please validate your email at ${host}/validate-email?code=${code}&validate=${validate} in case you ever need to reset your password. (Which can be done at ${host}/reset-password if required${code === "admin" ? "." : `, using the code ${code}`})
`
  mail(email, "Validate Email", message)
}

function mail(email, subject, message) {
  if (!process.env.MAIL_FROM) {
    console.log("email", email)
    console.log("subject", subject)
    console.log("message", message)
    return
  }

  nodemailer.createTransport({sendmail: true}).sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: subject,
    text: message,
  }, (err, info) => {
    if (err) {
      console.log(err)
      return
    }
    console.log(info)
  })
}

function saveFeed(data) {
  user.get("feeds").get(data.xml_url).put({
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
  user.get("items").get(lastSaved).put({
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
