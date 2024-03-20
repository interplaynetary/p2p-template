import { useEffect, useState, useReducer } from "react"
import Gun from "gun"
import "./App.css"
import Item from "./components/Item"
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

function reducer(state, m) {
  return {
    items: state.timestamps.includes(m.createdAt) ? state.items : [m, ...state.items],
    timestamps: [m.createdAt, ...state.timestamps]
  }
}

function App() {
  const [display, dispatch] = useReducer(reducer, {items:[], timestamps:[]})
  const [hostPublicKey, setHostPublicKey] = useState(() => {
    // Get initial state from local storage.
    return localStorage.getItem("hostPublicKey") || ""
  })

  useEffect(() => {
    // Update local storage whenever the host public key changes.
    localStorage.setItem("hostPublicKey", hostPublicKey)

    // Fetch it when it's not set.
    if (hostPublicKey === "") {
      fetch(`${window.location}host-public-key`)
        .then(res => res.text())
        .then(res => setHostPublicKey(res))
        .catch(err => console.log(err))
    } else {
      // Display items when it is set.
      const items = gun.get(hostPublicKey).get("public").get("items")
      items.map().once((data, key) => {
        dispatch({
          name: data.name,
          message: data.message,
          createdAt: key,
        })
      })
    }
  }, [hostPublicKey])

  return (
    <Container maxWidth="sm">
      <Grid container spacing={5}>
        {display.items.map(data => <Item key={data.createdAt} message={data}/>)}
      </Grid>
    </Container>
  )
}

export default App
