import { useState } from "react"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
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

const Register = ({user, host}) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")
  const [disabledButton, setDisabledButton] = useState(false)
  return (
      <Grid item xs={12}>
      <Card sx={{mt:2}}>
        <CardContent>
          <Typography variant="h5">Register</Typography>
          <TextField
            id="register-username"
            label="Username"
            variant="outlined"
            fullWidth={true}
            margin="normal"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <FormControl variant="outlined"
            fullWidth={true}
            margin="normal"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
                    {showPassword ? <VisibilityOff/> : <Visibility/>}
                  </IconButton>
                </InputAdornment>
              }
              label="Password"
            />
          </FormControl>
          <TextField
            id="register-code"
            label="Invite code"
            variant="outlined"
            fullWidth={true}
            margin="normal"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button sx={{mt:1}} variant="contained" disabled={disabledButton}
            onClick={() => {
              if (user.is) {
                setMessage("You're already logged in!")
                return
              }

              setDisabledButton(true)
              setMessage("Checking invite code...")
              fetch(`${host}/check-invite-code`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json;charset=utf-8"
                },
                body: JSON.stringify({code: code}),
              })
              .then(res => res.text().then(text => ({ok: res.ok, text: text})))
              .then(res => {
                if (res.ok) {
                  user.create(username, password, ack => {
                    if (ack.err) {
                      setDisabledButton(false)
                      setMessage(ack.err)
                    } else {
                      user.auth(username, password, ack => {
                        if (ack.err) {
                          setDisabledButton(false)
                          setMessage(ack.err)
                        } else {
                          fetch(`${host}/claim-invite-code`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json;charset=utf-8"
                            },
                            body: JSON.stringify({code: code, pub:ack.get}),
                          })
                          .then(res => res.text().then(text => ({ok: res.ok, text: text})))
                          .then(res => {
                            setDisabledButton(false)
                            if (res.ok) {
                              setMessage("Account created")
                              window.location = host
                            } else {
                              user.delete(username, password)
                              setMessage(res.text)
                            }
                          })
                        }
                      })
                    }
                  })
                } else {
                  setDisabledButton(false)
                  setMessage(res.text)
                }
              })
              .catch(err => {
                setDisabledButton(false)
                setMessage("Could not create account")
                console.log(err)
              })
            }}
          >Submit</Button>
          {message &&
           <Typography sx={{m:1}} variant="string">{message}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  )
}

export default Register
