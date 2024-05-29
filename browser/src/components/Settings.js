import { useState, useEffect } from "react"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Container from "@mui/material/Container"
import FilledInput from "@mui/material/FilledInput"
import FormControl from "@mui/material/FormControl"
import Grid from "@mui/material/Grid"
import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import InputLabel from "@mui/material/InputLabel"
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import OutlinedInput from "@mui/material/OutlinedInput"
import Typography from "@mui/material/Typography"
import ContentCopy from '@mui/icons-material/ContentCopy';
import Visibility from "@mui/icons-material/Visibility"
import VisibilityOff from "@mui/icons-material/VisibilityOff"
import SearchAppBar from "./SearchAppBar"

import Gun from "gun"
require("gun/lib/radix.js")
require("gun/lib/radisk.js")
require("gun/lib/store.js")
require("gun/lib/rindexed.js")
require("gun/sea")

const Settings = ({host, user, code, mode, setMode}) => {
  const [name] = useState(() => {
    return sessionStorage.getItem("name") || ""
  })
  const [invites, setInvites] = useState([])
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState("")
  const [disabledButton, setDisabledButton] = useState(false)

  useEffect(() => {
    if (!host || !user || !code) return

    host.get("epub").once(async epub => {
      if (!epub) {
        console.error("No epub for host!")
        return
      }

      let set = false
      const updated = new Map()
      const secret = await Gun.SEA.secret(epub, user._.sea)
      const shared = host.get("shared").get("invite_codes").get(code)
      shared.map().on(async (enc, key) => {
        if (enc) {
          updated.set(key, {key: key, code: await Gun.SEA.decrypt(enc, secret)})
        } else {
          updated.delete(key)
        }
        set = true
      }, {wait: 0})
      // Batch the update otherwise there are too many calls to setInvites.
      setInterval(() => {
        if (!set) return
        setInvites([...updated.values()])
        set = false
      }, 1000)
    }, {wait: 0})
  }, [host, user, code])

  const select = (target) => {
    const li = target.closest("li")
    if (li && li.childNodes[0].childNodes[0].nodeName === "INPUT") {
      li.childNodes[0].childNodes[0].select()
    }
    else {
      console.error("not input field", li.childNodes[0].childNodes[0].nodeName)
      console.log("parent li", li)
    }
  }

  const changePassword = () => {
    if (!password) {
      setMessage("Please provide a new password")
      return
    }

    setDisabledButton(true)
    setMessage("Updating password...")
    user.auth(user._.sea, ack => {
      setDisabledButton(false)
      if (ack.err) {
        setMessage(ack.err)
      } else {
        setMessage("Password updated")
      }
    }, {change: password})
  }

  return (
    <>
    {user.is && <SearchAppBar mode={mode} setMode={setMode}/>}
    <Container maxWidth="sm">
      <Grid container spacing={5}>
        <Grid item xs={12}>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography sx={{m:1}}>{name ?
                "Hello " + name : "Account not found. Please try logging in again."}
              </Typography>
              {invites.length !== 0 &&
              <Typography sx={{m:1}}>
                You have {invites.length} invite code{invites.length > 1 && "s"} you can share
              </Typography>}
              <List dense={true} sx={{maxHeight: 300, overflow: "auto"}}>
                {invites.map(invite =>
                  <ListItem key={invite.key}>
                    <FilledInput
                      defaultValue={invite.code}
                      readOnly={true}
                      endAdornment={
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            aria-label="copy invite code"
                            onClick={(event) => {select(event.target)}}
                          >
                            <ContentCopy/>
                          </IconButton>
                        </InputAdornment>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography sx={{m:1}}>Use this form to change your password</Typography>
              <FormControl variant="outlined"
                fullWidth={true}
                margin="normal"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              >
                <InputLabel htmlFor="settings-password">New Password</InputLabel>
                <OutlinedInput
                  id="settings-password"
                  autoComplete="new-password"
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
                onClick={changePassword}
              >Submit</Button>
              {message &&
               <Typography sx={{m:1}} variant="string">{message}</Typography>}
            </CardContent>
          </Card>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography sx={{m:1}}>Log out of your account</Typography>
              <Button sx={{mt:1}} variant="contained" onClick={() => {
                user.leave()
                sessionStorage.removeItem("name")
                sessionStorage.removeItem("code")
                window.location = "/login"
              }}>Logout</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
    </>
  )
}

export default Settings
