import {useState} from "react"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Container from "@mui/material/Container"
import FormControl from "@mui/material/FormControl"
import Grid from "@mui/material/Grid"
import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import InputLabel from "@mui/material/InputLabel"
import OutlinedInput from "@mui/material/OutlinedInput"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import Visibility from "@mui/icons-material/Visibility"
import VisibilityOff from "@mui/icons-material/VisibilityOff"
import SearchAppBar from "./SearchAppBar"

import Gun from "gun"
require("gun/lib/radix.js")
require("gun/lib/radisk.js")
require("gun/lib/store.js")
require("gun/lib/rindexed.js")
require("gun/sea")

const gun = Gun({
  peers: [
    window.location.hostname === "localhost"
      ? "http://localhost:8765/gun"
      : window.location.origin + "/gun",
  ],
  axe: false,
  secure: true,
  localStorage: false,
  store: window.RindexedDB(),
})

const Register = ({loggedIn, mode, setMode}) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [message, setMessage] = useState(loggedIn ? "Already logged in" : "")
  const [disabledButton, setDisabledButton] = useState(loggedIn)

  const register = () => {
    if (!username) {
      setMessage("Please choose a username")
      return
    }
    if (!/^\w+$/.test(username)) {
      setMessage("Username must contain only numbers, letters and underscore")
      return
    }
    if (!email) {
      setMessage("Please provide your email")
      return
    }

    setDisabledButton(true)
    setMessage("Checking invite code...")
    fetch(`${window.location.origin}/check-invite-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
      },
      body: JSON.stringify({code: code}),
    })
      .then(res => res.text().then(text => ({ok: res.ok, text: text})))
      .then(res => {
        if (!res.ok) {
          setDisabledButton(false)
          setMessage(res.text)
          return
        }

        const user = gun.user()
        user.create(username, password, ack => {
          if (ack.err) {
            setDisabledButton(false)
            setMessage(ack.err)
            return
          }

          user.auth(username, password, ack => {
            if (ack.err) {
              setDisabledButton(false)
              setMessage(ack.err)
              return
            }

            fetch(`${window.location.origin}/claim-invite-code`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json;charset=utf-8",
              },
              body: JSON.stringify({
                code: code,
                pub: user.is.pub,
                alias: username,
                email: email,
              }),
            })
              .then(res => res.text().then(text => ({ok: res.ok, text: text})))
              .then(res => {
                setDisabledButton(false)
                if (!res.ok) {
                  user.delete(username, password)
                  setMessage(res.text)
                  return
                }

                setMessage("Account created")
                window.location = "/login"
              })
          })
        })
      })
  }

  return (
    <>
      {loggedIn && <SearchAppBar mode={mode} setMode={setMode} />}
      <Container maxWidth="sm">
        <Grid container>
          <Grid item xs={12}>
            <Card sx={{mt: 2}}>
              <CardContent>
                <Typography variant="h5">Register</Typography>
                <TextField
                  id="register-username"
                  label="Username"
                  variant="outlined"
                  fullWidth={true}
                  margin="normal"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                />
                <FormControl
                  variant="outlined"
                  fullWidth={true}
                  margin="normal"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                >
                  <InputLabel htmlFor="register-password">Password</InputLabel>
                  <OutlinedInput
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(show => !show)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label="Password"
                  />
                </FormControl>
                <TextField
                  id="register-email"
                  label="Email"
                  variant="outlined"
                  fullWidth={true}
                  margin="normal"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                />
                <TextField
                  id="register-code"
                  label="Invite code"
                  variant="outlined"
                  fullWidth={true}
                  margin="normal"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
                <Button
                  sx={{mt: 1}}
                  variant="contained"
                  disabled={disabledButton}
                  onClick={register}
                >
                  Submit
                </Button>
                {message && (
                  <Typography sx={{m: 1}} variant="string">
                    {message}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  )
}

export default Register
