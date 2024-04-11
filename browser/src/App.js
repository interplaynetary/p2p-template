import { useEffect, useState, useReducer } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Gun from "gun"
import "./App.css"
import Item from "./components/Item"
import Login from "./components/Login"
import Register from "./components/Register"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"

require("gun/lib/radix.js")
require("gun/lib/radisk.js")
require("gun/lib/store.js")
require("gun/lib/rindexed.js")
require("gun/sea")

const gun = Gun({
  peers: [process.env.REACT_APP_HOST],
  axe: false,
  secure: true,
  localStorage: false,
  store: window.RindexedDB(),
})
const user = gun.user().recall({sessionStorage: true})
const host = window.location.protocol + "//" + window.location.host

function reducer(current, add) {
  return {
    items: current.keys.includes(add.key) ? current.items : [add, ...current.items],
    keys: [add.key, ...current.keys],
  }
}

function App() {
  const [display, updateDisplay] = useReducer(reducer, {items:[], keys:[]})
  const [hostPublicKey, setHostPublicKey] = useState(() => {
    // Get initial state from local storage.
    return localStorage.getItem("hostPublicKey") || ""
  })

  useEffect(() => {
    // Update local storage whenever the host public key changes.
    localStorage.setItem("hostPublicKey", hostPublicKey)

    // Fetch host public key when not set.
    if (hostPublicKey === "") {
      fetch(`${host}/host-public-key`)
        .then(res => res.text())
        .then(res => setHostPublicKey(res))
        .catch(err => console.log(err))
    } else {
      // Display items when host public key is set.

      // TODO: items should be paginated and categorised here. To do that need
      // to pass in more dependencies and use them to decide which items to
      // get using a date filter first and then filtering that subset by
      // categories the user has selected.
      const items = gun.get(hostPublicKey).get("public").get("items")
      items.map().once((data, key) => {
        updateDisplay({
          key: key,
          title: data.title,
          content: data.content,
          author: data.author,
          category: data.category,
          enclosure: data.enclosure,
          permalink: data.permalink,
          guid: data.guid,
          timestamp: data.timestamp,
          xml_url: data.xml_url,
        })
      })
    }
  }, [hostPublicKey])

  return (
    <Container maxWidth="sm">
      <Grid container spacing={5}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login user={user} host={host}/>}/>
            <Route path="/register" element={<Register user={user} host={host}/>}/>
            <Route path="/" element={display.items.map(item => <Item key={item.key} item={item}/>)}/>
          </Routes>
        </BrowserRouter>
      </Grid>
    </Container>
  )
}

export default App
