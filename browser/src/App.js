import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import Display from "./components/Display"
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
const pages = ["register", "login", "settings", "validate-email",
               "reset-password", "update-password"]
const redirect = params.get("redirect")
const to = redirect ? (pages.includes(redirect) ? `/${redirect}` : "/") : ""

const App = () => {
  const [host, setHost] = useState(null)
  const [pub, setPub] = useState(() => {
    return localStorage.getItem("pub") || ""
  })
  useEffect(() => {
    if (!pub) {
      fetch(`${window.location.origin}/host-public-key`)
        .then(res => res.text())
        .then(key => setPub(key))
      return
    }

    setHost(gun.user(pub))
    localStorage.setItem("pub", pub)
    gun.user(pub).get("accounts").map().on((account, code) => {
      if (!account) return

      // TODO: If an account code is in users list of known accounts then check
      // if their pub has changed and re-share encrypted data with them.
      console.log("account", code)
    })
  }, [pub])

  return (
    <Container maxWidth="sm">
      <Grid container spacing={5}>
        <BrowserRouter>
          <Routes>
            <Route path="/register" element={
              <Register loggedIn={user.is}/>
            }/>
            <Route path="/login" element={
              <Login host={host} user={user}/>
            }/>
            <Route path="/validate-email" element={
              <ValidateEmail
                code={params.get("code")}
                validate={params.get("validate")}
              />
            }/>
            <Route path="/reset-password" element={
              <ResetPassword loggedIn={user.is}/>
            }/>
            <Route path="/update-password" element={
              <UpdatePassword
                loggedIn={user.is}
                current={params.get("username")}
                code={params.get("code")}
                reset={params.get("reset")}
              />
            }/>
            <Route path="/settings" element={
              user.is ? <Settings host={host} user={user}/> :
                <Navigate to="/login"/>
            }/>
            <Route path="/" element={
              to ? <Navigate to={to}/> :
                <Display user={user} gun={gun} host={host}/>
            }/>
          </Routes>
        </BrowserRouter>
      </Grid>
    </Container>
  )
}

export default App
