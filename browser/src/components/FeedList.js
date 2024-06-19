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

// TODO: Display a filtered list using the search bar.
const FeedList = ({host, user, done}) => {
  const [groupName, setGroupName] = useState("")
  const [selected, setSelected] = useState([])
  const [feeds, updateFeed] = useReducer(reducer, init)

  useEffect(() => {
    if (!host) return
    host.get("feeds").map().on((data, key) => {
      if (!data) return
      updateFeed({key, ...data})
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
    user.get("public").get("groups").set({
      name: groupName,
      feeds: selected.reduce((acc, feed) => {
        // Convert selected feeds to an object to store in gun.
        // see GroupList useEffect which converts back to an array.
        return {...acc, [feed]: ""}
      }, {}),
      updated: Date.now(),
    })
    done()
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
                disabled={selected.length === 0 || groupName === ""}
                onClick={createGroup}
              >Submit</Button>
              {selected.length > 0 &&
               <Typography sx={{m:1}} variant="string">
                 {`${selected.length} feed${selected.length > 1 ? "s" : ""} selected`}
               </Typography>}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <List>
            {feeds &&
             feeds.all.map(feed => <Feed
                                     feed={feed}
                                     selected={selected.includes(feed.key)}
                                     selectItem={selectItem}
                                   />)}
          </List>
        </Grid>
      </Grid>
    </Container>
  )
}

export default FeedList
