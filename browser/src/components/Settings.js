import { useState, useEffect } from "react"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"

import Gun from "gun"
require("gun/lib/radix.js")
require("gun/lib/radisk.js")
require("gun/lib/store.js")
require("gun/lib/rindexed.js")
require("gun/sea")

const Settings = ({host, user}) => {
  const [name] = useState(() => {
    return sessionStorage.getItem("name") || ""
  })
  const [code] = useState(() => {
    return sessionStorage.getItem("code") || ""
  })
  const [invites, setInvites] = useState([])
  useEffect(() => {
    if (!host || !user || !code) return

    host.get("epub").once(async epub => {
      if (!epub) {
        console.error("No epub for host!")
        return
      }

      let set = false
      let updated = []
      const secret = await Gun.SEA.secret(epub, user._.sea)
      const owner = host.get("shared").get("invite_codes").get(code)
      owner.map().on(async (enc, key) => {
        const index = updated.findIndex(invite => invite.key === key)
        if (enc && index === -1) {
          set = true
          updated.push({key: key, code: await Gun.SEA.decrypt(enc, secret)})
        } else if (!enc && index !== -1) {
          set = true
          updated.splice(index, 1)
        }
      }, {wait: 0})
      // Batch the update otherwise there are too many calls to setInvites.
      setInterval(() => {
        if (!set) return

        set = false
        // Needs a new array to render.
        setInvites([...updated])
      }, 5000)
    }, {wait: 0})
  }, [host, user, code])

  return (
    <Grid item xs={12}>
      <Typography sx={{m:1}}>Hello {name}</Typography>
      {invites.length !== 0 &&
        <Typography sx={{m:1}}>
          You have {invites.length} invite code{invites.length === 1 ? "" : "s"}
        </Typography>}
      {invites.map(invite =>
        <Typography sx={{m:1}} key={invite.key}>{invite.code}</Typography>)
      }
      <Button sx={{mt:1}} variant="contained" onClick={() => {
        user.leave()
        sessionStorage.removeItem("name")
        sessionStorage.removeItem("code")
        window.location = "/login"
      }}>Logout</Button>
    </Grid>
  )
}

export default Settings
