const express = require("express")
const path = require("path")
const bodyParser = require("body-parser")
const nodemailer = require("nodemailer")
const Gun = require("gun")
require("gun/lib/then.js")
require("gun/sea")

const app = express()
const gun = Gun({
  web: app.listen(8765),
  multicast: false,
  axe: false,
  secure: true,
})
const user = gun.user()
const alias = process.env.GUN_USER_ALIAS ?? "host"
const pass = process.env.GUN_USER_PASS ?? "password"
const host = process.env.APP_HOST ?? "http://localhost:3000"

// See ../browser/src/utils/text.js.
const a = t => {
  try {
    return atob(t)
  } catch {
    return ""
  }
}
const b = t => {
  try {
    return btoa(t)
  } catch {
    return ""
  }
}
const enc = t =>
  b(
    Array.from(new TextEncoder().encode(t), e => String.fromCodePoint(e)).join(
      "",
    ),
  )
const dec = t =>
  new TextDecoder().decode(Uint8Array.from(a(t), e => e.codePointAt(0)))

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

app.get("/invite", (req, res) => {
  res.redirect("/?redirect=invite")
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

app.get("/help", (req, res) => {
  res.redirect("/?redirect=help")
})

app.get("/validate-email", (req, res) => {
  res.redirect(
    `/?redirect=validate-email&code=${req.query.code}&validate=${req.query.validate}`,
  )
})

app.get("/reset-password", (req, res) => {
  res.redirect("/?redirect=reset-password")
})

app.get("/update-password", (req, res) => {
  res.redirect(
    `/?redirect=update-password&username=${req.query.username}&code=${req.query.code}&reset=${req.query.reset}`,
  )
})

app.post("/request-invite-code", (req, res) => {
  if (!req.body.email) {
    res.status(400).send("email required")
    return
  }

  requestInvite(req.body.email)
  res.send("Invite code requested")
})

app.post("/check-codes", async (req, res) => {
  if (!req.body.codes || req.body.codes.length === 0) {
    res.status(400).send("codes required")
    return
  }

  if (await checkCodes(req.body.codes)) {
    res.end() // ok
    return
  }

  res.status(400).send("duplicate code found")
})

app.post("/check-invite-code", (req, res) => {
  const code = req.body.code || "admin"
  if (inviteCodes.has(code)) {
    res.end() // ok
    return
  }

  // This just provides relevant errors.
  user
    .get("accounts")
    .get(code)
    .once(used => {
      if (used) {
        if (code === "admin") {
          res.status(400).send("Please provide an invite code")
          return
        }
        res.status(400).send("Invite code already used")
        return
      }
      res.status(404).send("Invite code not found")
    })
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
  if (!/^\w+$/.test(req.body.alias)) {
    res
      .status(400)
      .send("Username must contain only numbers, letters and underscore")
    return
  }
  if (!req.body.email) {
    res.status(400).send("Email required")
    return
  }

  const validate = newCode()
  const encValidate = await Gun.SEA.encrypt(validate, user._.sea)
  const encEmail = await Gun.SEA.encrypt(req.body.email, user._.sea)
  const data = {
    pub: req.body.pub,
    alias: req.body.alias,
    name: req.body.alias,
    email: encEmail,
    validate: encValidate,
    ref: invite.owner,
    host: enc(host),
    feeds: 10,
  }
  user
    .get("accounts")
    .get(code)
    .put(data, ack => {
      if (ack.err) console.error(ack.err)
    })
  validateEmail(req.body.alias, req.body.email, code, validate)

  // Remove invite code as it's no longer available.
  user
    .get("available")
    .get("invite_codes")
    .get(invite.key)
    .put(null, ack => {
      if (ack.err) console.error(ack.err)
    })
  inviteCodes.delete(code)

  if (code === "admin") {
    res.end()
    return
  }

  // Also remove from shared codes of the invite owner.
  user
    .get("accounts")
    .get(invite.owner)
    .once(account => {
      if (!account) {
        console.log("Account not found for invite.owner!")
        res.end()
        return
      }

      gun
        .user(account.pub)
        .get("epub")
        .once(epub => {
          if (!epub) {
            console.log("User not found for public key")
            res.end()
            return
          }

          const owner = user.get("shared").get("invite_codes").get(invite.owner)
          owner.once(async codes => {
            const secret = await Gun.SEA.secret(epub, user._.sea)
            for (let [key, enc] of Object.entries(codes)) {
              if (!enc) continue

              let shared = await Gun.SEA.decrypt(enc, secret)
              if (code === shared) {
                owner.get(key).put(null, ack => {
                  if (ack.err) console.error(ack.err)
                })
                break
              }
            }
          })
          res.end()
        })
    })
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

  user
    .get("accounts")
    .get(code)
    .once(async account => {
      if (!account) {
        res.status(404).send("Account not found")
        return
      }
      if (!account.validate) {
        res.send("Email already validated")
        return
      }

      const validate = await Gun.SEA.decrypt(account.validate, user._.sea)
      if (validate !== req.body.validate) {
        res.status(400).send("Validation code does not match")
        return
      }

      user
        .get("accounts")
        .get(code)
        .put({validate: null}, ack => {
          if (ack.err) console.error(ack.err)
        })
      res.send("Email validated")
    })
})

app.post("/reset-password", (req, res) => {
  if (!req.body.email) {
    res.status(400).send("Email required")
    return
  }

  const code = req.body.code || "admin"
  user
    .get("accounts")
    .get(code)
    .once(async account => {
      if (!account) {
        res.status(404).send("Account not found")
        return
      }

      let increment = 0
      const match = account.alias.match(/\.(\d)$/)
      if (match) {
        increment = Number(match[1])
      }
      if (increment === 9) {
        res.status(400).send("Too many password resets")
        return
      }

      const email = await Gun.SEA.decrypt(account.email, user._.sea)
      if (email !== req.body.email) {
        res.status(400).send("Email does not match invite code")
        return
      }
      if (account.validate) {
        res.status(400).send("Please validate your email first")
        return
      }

      const reset = newCode()
      const remaining = 8 - increment
      const data = {
        reset: await Gun.SEA.encrypt(reset, user._.sea),
        expiry: Date.now() + 86400000,
      }
      user
        .get("accounts")
        .get(code)
        .put(data, ack => {
          if (ack.err) console.error(ack.err)
        })

      resetPassword(account.name, remaining, email, code, reset)
      res.send("Reset password email sent")
    })
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

  user
    .get("accounts")
    .get(code)
    .once(async account => {
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

      const reset = await Gun.SEA.decrypt(account.reset, user._.sea)
      if (reset !== req.body.reset) {
        res.status(400).send("Reset code does not match")
        return
      }

      const data = {
        pub: req.body.pub,
        alias: req.body.alias,
        name: req.body.name,
        prev: account.pub,
      }
      user
        .get("accounts")
        .get(code)
        .put(data, ack => {
          if (ack.err) console.error(ack.err)
        })
      res.send(account.pub)
    })
})

app.post("/add-feed", (req, res) => {
  const code = req.body.code
  if (!code) {
    res.status(400).send({error: "code required"})
    return
  }
  if (!req.body.url) {
    res.status(400).send({error: "url required"})
    return
  }

  user
    .get("accounts")
    .get(code)
    .once(async account => {
      if (!account) {
        res.status(404).send({error: "Account not found"})
        return
      }

      const url = await Gun.SEA.verify(req.body.url, account.pub)
      if (!url) {
        res.status(400).send({error: "Could not verify signed url"})
        return
      }

      gun
        .user(account.pub)
        .get("public")
        .get("feeds")
        .once(feeds => {
          if (!feeds) {
            res.status(500).send({error: "Error checking feeds"})
            return
          }

          delete feeds._
          if (
            Object.values(feeds).filter(feed => feed.title).length ===
            account.feeds
          ) {
            res
              .status(400)
              .send(`Account currently has a limit of ${account.feeds} feeds`)
            return
          }

          const addFeedUrl = process.env.ADD_FEED_URL
          const addFeedID = process.env.ADD_FEED_ID
          const addFeedApiKey = process.env.ADD_FEED_API_KEY
          if (!addFeedUrl || !addFeedID || !addFeedApiKey) {
            res.status(500).send({error: "Could not add feed, env not set"})
            return
          }

          fetch(addFeedUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json;charset=utf-8",
            },
            body: JSON.stringify({
              id: addFeedID,
              key: addFeedApiKey,
              action: "add-feed",
              xmlUrl: url,
            }),
          })
            .then(res => res.json().then(json => ({ok: res.ok, json: json})))
            .then(res => {
              if (!res.ok) {
                console.log("Error from", addFeedUrl, url)
                res.status(500).send({error: "Error adding feed"})
                return
              }

              if (res.json.error) {
                console.log("Error from", addFeedUrl, url)
                console.log(res.json.error)
                res.status(500).send({error: "Error adding feed"})
                return
              }

              const data = {
                title: enc(res.json.add.title),
                description: enc(res.json.add.description),
                html_url: enc(res.json.add.html_url),
                language: enc(res.json.add.language),
                image: enc(res.json.add.image),
              }
              user
                .get("feeds")
                .get(enc(url))
                .put(data, ack => {
                  if (ack.err) {
                    console.log(ack.err)
                    res.status(500).send("Error saving feed")
                    return
                  }

                  res.send(res.json)
                })
            })
        })
    })
})

app.post("/private/create-invite-codes", (req, res) => {
  const code = req.body.code
  if (!code) {
    res.status(400).send("Invite code required")
    return
  }

  user
    .get("accounts")
    .get(code)
    .once(account => {
      if (!account) {
        res.status(404).send("Account not found")
        return
      }
      if (account.validate) {
        res.status(400).send("Email not validated")
        return
      }

      gun
        .user(account.pub)
        .get("epub")
        .once(epub => {
          if (!epub) {
            res.status(404).send("User not found for public key")
            return
          }

          if (createInviteCodes(req.body.count || 1, code, epub)) {
            res.end()
          } else {
            res
              .status(500)
              .send(
                "Error creating codes. Please check the logs for errors and try again",
              )
          }
        })
    })
})

app.post("/private/update-feed-limit", (req, res) => {
  const code = req.body.code
  if (!code) {
    res.status(400).send("code required")
    return
  }

  const limit = req.body.limit
  if (!limit) {
    res.status(400).send("limit required")
    return
  }

  user
    .get("accounts")
    .get(code)
    .once(account => {
      if (!account) {
        res.status(404).send("Account not found")
        return
      }
      if (account.validate) {
        res.status(400).send("Email not validated")
        return
      }

      user
        .get("accounts")
        .get(code)
        .put({feeds: limit}, ack => {
          if (ack.err) console.error(ack.err)
        })
      res.end()
    })
})

app.post("/private/remove-feed", (req, res) => {
  if (!req.body.url) {
    res.status(400).send("url required")
    return
  }

  user
    .get("feeds")
    .get(enc(req.body.url))
    .put(null, ack => {
      if (!ack.err) {
        res.end()
        return
      }

      console.log(ack.err)
      res.status(500).send("Error removing feed")
    })
})

app.post("/private/add-item", (req, res) => {
  if (!req.body.url) {
    res.status(400).send("url required")
    return
  }

  // limit and wait times are in milliseconds.
  const limit = 10
  var wait = 0

  if (lastSaved !== 0) {
    const elapsed = Date.now() - lastSaved
    if (elapsed < limit) {
      wait = limit - elapsed
      console.log("Waiting " + wait + " ms before save")
    }
  }
  setTimeout(() => {
    lastSaved = Date.now()
    const item = {
      title: enc(req.body.title),
      content: enc(req.body.content),
      author: enc(req.body.author),
      category: enc(req.body.category),
      enclosure: enc(req.body.enclosure),
      permalink: enc(req.body.permalink),
      guid: enc(req.body.guid),
      timestamp: enc(req.body.timestamp),
      url: enc(req.body.url),
    }
    // If the given item has a guid and it's timestamp is older than 2 hours,
    // then check if there's an existing item and update that instead.
    if (req.body.guid && req.body.timestamp < lastSaved - 7200000) {
      let found = false
      user
        .get("items")
        .map()
        .once((check, key) => {
          if (!check || found) return

          if (
            check.guid &&
            check.guid === item.guid &&
            check.url === item.url
          ) {
            found = true
            user
              .get("items")
              .get(key)
              .put(item, ack => {
                if (!ack.err) {
                  res.end()
                  return
                }

                console.log(ack.err)
                res.status(500).send("Error saving item")
              })
          }
        })
      setTimeout(() => {
        // If not found then give the item the current time so that it's not
        // buried. Don't want to see all items when subscribing to a new feed,
        // so ignore items older than 48 hours.
        if (!found && req.body.timestamp > lastSaved - 172800000) {
          user
            .get("items")
            .get(lastSaved)
            .put(item, ack => {
              if (!ack.err) {
                res.end()
                return
              }

              console.log(ack.err)
              res.status(500).send("Error saving item")
            })
        }
      }, 5000)
      return
    }

    user
      .get("items")
      .get(lastSaved)
      .put(item, ack => {
        if (!ack.err) {
          res.end()
          return
        }

        console.log(ack.err)
        res.status(500).send("Error saving item")
      })
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

      // Note that the admin invite code doesn't have an account associated
      // with it, but once it's been claimed all invite codes that get created
      // will have an owner code that get stored as the referring account.
      console.log("Creating admin invite code")
      const enc = await Gun.SEA.encrypt({code: "admin", owner: ""}, user._.sea)
      user.get("available").get("invite_codes").set(enc)
      mapInviteCodes()
    })
  })
}

function mapInviteCodes() {
  // map subscribes to invite_codes, so this will also be called when new
  // invite codes are created.
  user
    .get("available")
    .get("invite_codes")
    .map()
    .once(async (enc, key) => {
      if (!enc) return

      const invite = await Gun.SEA.decrypt(enc, user._.sea)
      if (!inviteCodes.has(invite.code)) {
        invite.key = key
        inviteCodes.set(invite.code, invite)
      }
    })
}

async function checkCodes(newCodes) {
  const codes = Object.keys(await user.get("accounts").then())
  for (let i = 0; i < newCodes.length; i++) {
    if (codes.includes(newCodes[i])) return false
    if (inviteCodes.has(newCodes[i])) return false
  }
  return true
}

async function checkHosts(newCodes) {
  // Check for a comma separated list of federated hosts that should be checked
  // for duplicate codes. Note that the other servers don't need to store the
  // codes, they just each need to check that the list they create doesn't
  // contain duplicates when they also want to store new codes.
  const hosts = process.env.FEDERATED_HOSTS
  if (hosts === "") return true

  const urls = hosts.split(",").map(url => url + "/check-codes")
  return (
    await Promise.all(
      urls.map(url =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=utf-8",
          },
          body: JSON.stringify({
            codes: newCodes,
          }),
        }).then(res => {
          if (!res.ok) {
            console.log(`checkHosts ${res.status} from ${res.url}`)
          }
          return res.ok
        }),
      ),
    )
  ).every(ok => ok)

  // Notes for further federated updates:
  // Other hosts can decide if they want to allow logins from federated user
  // accounts by listening to get("accounts").map().on() for each of the known
  // federated hosts and adding them to their own list of accounts. "host" is
  // provided in the account data to point users to their host server, but the
  // user could provide their email to another host to allow password resets
  // their too... it would just be stored on the other host account data the
  // same as it's stored here, without sharing between servers. That server
  // can replace the "host" field in their account data in that case, and can
  // store their own validation code.
}

async function createInviteCodes(count, owner, epub) {
  let i = 0
  let newCodes = []
  while (i++ < count) {
    newCodes.push(newCode())
  }
  if (!(await checkCodes(newCodes)) || !(await checkHosts(newCodes))) {
    // If a duplicate code is found, return false and the request can be tried
    // again. More likely that a federated host is not reachable though, so
    // the list will need updating before making the request again.
    return false
  }

  const secret = await Gun.SEA.secret(epub, user._.sea)
  for (let i = 0; i < newCodes.length; i++) {
    let invite = {code: newCodes[i], owner: owner}
    let enc = await Gun.SEA.encrypt(invite, user._.sea)
    user.get("available").get("invite_codes").set(enc)
    let shared = await Gun.SEA.encrypt(newCodes[i], secret)
    user.get("shared").get("invite_codes").get(owner).set(shared)
  }
  return true
}

function requestInvite(email) {
  const message = `Thanks for requesting an invite code at ${host}

There is a waiting list to create new accounts, so an invite code will be sent to your email address: ${email} when it becomes available.`

  const bcc = process.env.MAIL_BCC
  // If MAIL_FROM is not set then the message is already logged.
  if (process.env.MAIL_FROM && !bcc) {
    console.log("Request Invite", email)
  }
  mail(email, "Request Invite", message, bcc)
}

function validateEmail(name, email, code, validate) {
  const message = `Hello ${name}
Thanks for creating an account at ${host}

Please validate your email at ${host}/validate-email?code=${code}&validate=${validate} in case you ever need to reset your password. (Which can be done at ${host}/reset-password if required${code === "admin" ? "." : `, using the code ${code}`})
`
  mail(email, "Validate Email", message)
}

function resetPassword(name, remaining, email, code, reset) {
  const message = `Hello ${name}
You can now update your password at ${host}/update-password?username=${name}&code=${code}&reset=${reset}

This link will be valid to use for the next 24 hours.

${remaining <= 5 ? `Note that you can only reset your password ${remaining} more time${remaining != 1 ? "s" : ""}.` : ""}
`
  mail(email, "Update Password", message)
}

function mail(email, subject, message, bcc) {
  if (!process.env.MAIL_FROM) {
    console.log("email", email)
    console.log("subject", subject)
    console.log("message", message)
    return
  }

  let data = {
    from: process.env.MAIL_FROM,
    to: email,
    subject: subject,
    text: message,
  }
  if (bcc) {
    data.bcc = bcc
  }
  nodemailer.createTransport({sendmail: true}).sendMail(data, (err, info) => {
    if (err) {
      console.log(err)
      return
    }
    console.log(info)
  })
}
