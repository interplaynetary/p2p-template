import {useEffect, useState, useMemo} from "react"
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom"
import {red} from "@mui/material/colors"
import {ThemeProvider, createTheme} from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import Display from "./components/Display"
import Help from "./components/Help"
import Register from "./components/Register"
import Login from "./components/Login"
import Settings from "./components/Settings"
import ValidateEmail from "./components/ValidateEmail"
import ResetPassword from "./components/ResetPassword"
import UpdatePassword from "./components/UpdatePassword"
import "./App.css"

import Gun from "gun"
require("gun/lib/radix.js")
require("gun/lib/radisk.js")
require("gun/lib/store.js")
require("gun/lib/rindexed.js")
require("gun/lib/then.js")
require("gun/sea")

const gun = Gun({
  peers: [`${window.location.protocol}//${window.location.hostname}:8765/gun`],
  axe: false,
  secure: true,
  localStorage: false,
  store: window.RindexedDB(),
})

const user = gun.user().recall({sessionStorage: true})
const params = new URLSearchParams(window.location.search)
const pages = [
  "register",
  "login",
  "settings",
  "help",
  "validate-email",
  "reset-password",
  "update-password",
]
const redirect = params.get("redirect")
const to = redirect ? (pages.includes(redirect) ? `/${redirect}` : "/") : ""

const App = () => {
  const [host, setHost] = useState(null)
  const [pub, setPub] = useState(() => {
    return localStorage.getItem("pub") || ""
  })
  const [code] = useState(() => {
    return sessionStorage.getItem("code") || ""
  })
  const [mode, setMode] = useState(() => {
    return sessionStorage.getItem("mode") || "light"
  })
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: red[900],
          },
          secondary: {
            main: red[500],
          },
        },
        components: {
          MuiDivider: {
            styleOverrides: {
              root: {
                color: red[900],
              },
            },
          },
        },
      }),
    [mode],
  )

  useEffect(() => {
    if (!pub) {
      fetch(`${window.location.origin}/host-public-key`)
        .then(res => res.text())
        .then(key => setPub(key))
      return
    }

    setHost(gun.user(pub))
    localStorage.setItem("pub", pub)
    if (!user.is) return

    gun
      .user(pub)
      .get("accounts")
      .map()
      .on((account, accountCode) => {
        if (!account) return

        let check = {
          pub: account.pub,
          alias: account.alias,
          name: account.name,
          ref: account.ref,
          host: account.host,
        }
        // Check this account against the users list of contacts.
        user
          .get("public")
          .get("contacts")
          .once(contacts => {
            let found = false
            for (let [contactCode, contact] of Object.entries(contacts ?? {})) {
              if (contactCode !== accountCode) continue

              found = true
              if (contact.pub === check.pub) break

              // If the public key has changed for this contact then store their
              // new account details and re-share encrypted data with them to
              // help restore their account.
              user
                .get("public")
                .get("contacts")
                .get(contactCode)
                .put(check, ack => {
                  if (ack.err) {
                    console.error(ack.err)
                  }
                })
              gun
                .user(contact.pub)
                .get("epub")
                .once(oldEPub => {
                  if (!oldEPub) {
                    console.error("User not found for old public key")
                    return
                  }

                  gun
                    .user(check.pub)
                    .get("epub")
                    .once(epub => {
                      if (!epub) {
                        console.error("User not found for new public key")
                        return
                      }

                      user
                        .get("shared")
                        .get(contactCode)
                        .once(async shared => {
                          if (!shared) return

                          const oldSecret = await Gun.SEA.secret(
                            oldEPub,
                            user._.sea,
                          )
                          const secret = await Gun.SEA.secret(epub, user._.sea)
                          for (let [key, oldEnc] of Object.entries(shared)) {
                            if (!oldEnc) continue

                            let data = await Gun.SEA.decrypt(oldEnc, oldSecret)
                            let enc = await Gun.SEA.encrypt(data, secret)
                            user
                              .get("shared")
                              .get(contactCode)
                              .get(key)
                              .put(enc, ack => {
                                if (ack.err) {
                                  console.error(ack.err)
                                }
                              })
                          }
                        })
                    })
                })
              break
            }
            // Add the new contact if we referred them.
            if (!found && account.ref === code) {
              user
                .get("public")
                .get("contacts")
                .get(accountCode)
                .put(check, ack => {
                  if (ack.err) {
                    console.error(ack.err)
                  }
                })
            }
          })
      })
  }, [pub, code])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route
            path="/register"
            element={
              <Register loggedIn={user.is} mode={mode} setMode={setMode} />
            }
          />
          <Route
            path="/login"
            element={
              <Login host={host} user={user} mode={mode} setMode={setMode} />
            }
          />
          <Route
            path="/validate-email"
            element={
              <ValidateEmail
                code={params.get("code")}
                validate={params.get("validate")}
              />
            }
          />
          <Route
            path="/reset-password"
            element={
              <ResetPassword loggedIn={user.is} mode={mode} setMode={setMode} />
            }
          />
          <Route
            path="/update-password"
            element={
              <UpdatePassword
                loggedIn={user.is}
                current={params.get("username")}
                code={params.get("code")}
                reset={params.get("reset")}
                mode={mode}
                setMode={setMode}
              />
            }
          />
          <Route
            path="/settings"
            element={
              user.is ? (
                <Settings
                  host={host}
                  user={user}
                  code={code}
                  mode={mode}
                  setMode={setMode}
                />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/help"
            element={<Help loggedIn={user.is} mode={mode} setMode={setMode} />}
          />
          <Route
            path="/"
            element={
              to ? (
                <Navigate to={to} />
              ) : user.is ? (
                <Display
                  host={host}
                  user={user}
                  mode={mode}
                  setMode={setMode}
                />
              ) : (
                <Help />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
