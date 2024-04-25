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

const Login = ({user}) => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showAuthError, setShowAuthError] = useState(false)
  const [disabledButton, setDisabledButton] = useState(false)

  function login(alias) {
    setDisabledButton(true)
    setShowAuthError(false)
    user.auth(alias, password, ack => {
      if (ack.err) {
        if (ack.err === "Wrong user or password.") {
          let match = alias.match(/(.*)\.(\d)$/)
          if (match) {
            let increment = Number(match[2]) + 1
            if (increment === 10) {
              setDisabledButton(false)
              setShowAuthError(true)
              return
            }
            login(`${match[1]}.${increment}`)
            return
          }
          login(`${alias}.1`)
          return
        }
        setDisabledButton(false)
        setShowAuthError(true)
      } else {
        setDisabledButton(false)
        window.location = "/"
      }
    })
  }

  return (
    <Grid item xs={12}>
      <Card sx={{mt:2}}>
        <CardContent>
          <Typography variant="h5">Login</Typography>
          <TextField
            id="login-username"
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
            <InputLabel htmlFor="login-password">Password</InputLabel>
            <OutlinedInput
              id="login-password"
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
          <Button sx={{mt:1}} variant="contained" disabled={disabledButton}
            onClick={() => login(username)}
          >Submit</Button>
          {showAuthError &&
           <Typography sx={{m:1}} variant="string">
             Wrong username or password
           </Typography>}
        </CardContent>
      </Card>
    </Grid>
  )
}

export default Login
