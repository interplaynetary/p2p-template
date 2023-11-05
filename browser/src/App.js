import { useEffect, useState, useReducer } from "react"
import Gun from "gun"
import "./App.css"
import Item from "./components/Item"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"

const gun = Gun({
  peers: [`${process.env.REACT_APP_HOST}:8765/gun`]
})

const initialState = {
  messages: [],
  timestamps: []
}

function reducer(state, m) {
  return {
    messages: state.timestamps.includes(m.createdAt) ? state.messages : [m, ...state.messages],
    timestamps: [m.createdAt, ...state.timestamps]
  }
}

function App() {
  const [formState, setForm] = useState({
    name: "", message: ""
  })

  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const messages = gun.get("messages")
    messages.map().once(m => {
      dispatch({
        name: m.name,
        message: m.message,
        createdAt: m.createdAt 
      })
    })
  }, [])

  function onChange(e) {
    setForm({ ...formState, [e.target.name]: e.target.value })
  }

  function saveMessage() {
    const messages = gun.get("messages")
    messages.set({
      name: formState.name,
      message: formState.message,
      createdAt: Date.now()
    })
    setForm({
      name: "", message: ""
    })
  }

  return (
    <div style={{ padding: 30 }}>
      <Container>
        <Grid container spacing={5}>
          <Item/>
        </Grid>
        <input
          onChange={onChange}
          placeholder="Name"
          name="name"
          value={formState.name}
        />
        <input
          onChange={onChange}
          placeholder="Message"
          name="message"
          value={formState.message}
        />
        <button onClick={saveMessage}>Send Message</button>
        {
          state.messages.map(message => (
            <div key={message.createdAt}>
              <h2>{message.message}</h2>
              <h3>From: {message.name}</h3>
              <p>Date: {message.createdAt}</p>
            </div> 
          ))
        }
      </Container>
    </div>
  ) 
}

export default App
