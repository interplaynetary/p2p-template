import {useEffect, useReducer, useState} from "react"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import List from "@mui/material/List"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import Feed from "./Feed"

const init = {all:[], keys:[]}
const reducer = (current, add) => {
  if (add.reset) return init
  return {
    all: current.keys.includes(add.key) ? current.all : [add, ...current.all],
    keys: [add.key, ...current.keys],
  }
}

const enc = t => btoa(Array.from(new TextEncoder().encode(t), e => String.fromCodePoint(e)).join(""))
const dec = t => t ? new TextDecoder().decode(Uint8Array.from(atob(t), e => e.codePointAt(0))) : ""

// TODO: Display a filtered list using the search bar.
const FeedList = ({host, user, done}) => {
  const [groupName, setGroupName] = useState("")
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState("")
  const [disabledButton, setDisabledButton] = useState(false)
  const [feeds, updateFeed] = useReducer(reducer, init)

  useEffect(() => {
    if (!host) return

    updateFeed({reset: true})
    // TODO: Filter by user.get("public").get("feeds"), which should be a
    // list of feeds the user has subscribed to so that they don't need to
    // see everyone else's...
    host.get("feeds").map().on((data, key) => {
      if (!data) return

      updateFeed({
        key: dec(key),
        title: dec(data.title),
        description: dec(data.description),
        html_url: dec(data.html_url),
        language: dec(data.language),
        image: dec(data.image),
      })
    })
  }, [host])

  const selectItem = feed => {
    if (selected.includes(feed.key)) {
      setSelected(selected.filter(key => key !== feed.key))
    } else {
      setSelected([...selected, feed.key])
    }
  }

  const createGroup = () => {
    setDisabledButton(true)
    setMessage("Creating group...")

    let group = {
      feeds: selected.reduce((acc, feed) => {
        // This function converts selected feeds to an object to store in gun.
        // see Display useEffect which converts back to an array.
        return {...acc, [enc(feed)]: ""}
      }, {}),
      // Show the timestamp of the last update.
      updated: 0,
    }
    let retry = 0
    const interval = setInterval(() => {
      user.get("public").get("groups").get(enc(groupName)).put(group, ack => {
        if (ack.err) {
          setDisabledButton(false)
          setMessage("Could not create group")
          console.error(ack.err)
          clearInterval(interval)
          return
        }

        clearInterval(interval)
        done()
      })
      if (retry > 5) {
        setDisabledButton(false)
        setMessage("Could not create group")
        clearInterval(interval)
      }
      retry++
    }, 1000)
  }

  return (
    <Container maxWidth="md">
      <Grid container>
        <Grid item xs={12}>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography variant="h5">New group</Typography>
              <TextField
                id="feedlist-new-group"
                label="Group name"
                variant="outlined"
                fullWidth={true}
                margin="normal"
                value={groupName}
                onChange={event => setGroupName(event.target.value)}
              />
              <Button
                sx={{mt:1}}
                variant="contained"
                disabled={selected.length === 0 || groupName === "" || disabledButton}
                onClick={createGroup}
              >Submit</Button>
              {selected.length > 0 && !message &&
               <Typography sx={{m:1}} variant="string">
                 {`${selected.length} feed${selected.length > 1 ? "s" : ""} selected`}
               </Typography>}
              {message &&
               <Typography sx={{m:1}} variant="string">{message}</Typography>}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <List>
            {feeds && feeds.all.map(f => <Feed
                                           feed={f}
                                           selected={selected.includes(f.key)}
                                           selectItem={selectItem}
                                         />)}
          </List>
        </Grid>
      </Grid>
    </Container>
  )
}

export default FeedList
