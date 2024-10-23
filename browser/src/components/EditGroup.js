import {useEffect, useReducer, useState} from "react"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import List from "@mui/material/List"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import {enc, dec} from "../utils/text.js"
import {init, reducer} from "../utils/reducer.js"
import Feed from "./Feed"

const EditGroup = ({user, groups, currentGroup, done}) => {
  const [groupName, setGroupName] = useState(currentGroup)
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState("")
  const [disabledButton, setDisabledButton] = useState(false)
  const [feeds, updateFeed] = useReducer(reducer(), init)
  const group = groups.all.find(g => g.key === currentGroup)

  useEffect(() => {
    if (!user) return

    user
      .get("public")
      .get("feeds")
      .map()
      .on((data, key) => {
        updateFeed({
          key: dec(key),
          title: data ? dec(data.title) : "",
          description: data ? dec(data.description) : "",
          html_url: data ? dec(data.html_url) : "",
          language: data ? dec(data.language) : "",
          image: data ? dec(data.image) : "",
        })
      })
  }, [user])

  const selectFeed = feed => {
    if (selected.includes(feed.key)) {
      setSelected(selected.filter(key => key !== feed.key))
    } else {
      setSelected([...selected, feed.key])
    }
  }

  const updateGroup = () => {
    const feeds = [...group.feeds, ...selected]
    if (feeds.length === 0) {
      if (
        !window.confirm("Removing all feeds will remove the group. Continue?")
      ) {
        return
      }
    }

    setDisabledButton(true)
    setMessage("Updating group...")

    const data = {
      feeds: feeds.reduce((acc, feed) => {
        // This function converts selected feeds to an object to store in gun.
        // see Display useEffect which converts back to an array.
        return {...acc, [enc(feed)]: ""}
      }, {}),
      count: group.count,
      latest: group.latest,
      text: enc(group.text),
      author: enc(group.author),
    }
    let retry = 0
    const interval = setInterval(() => {
      // Delete the old group if the name changes.
      if (group.key !== groupName) {
        user
          .get("public")
          .get("groups")
          .get(enc(group.key))
          .put(null, ack => {
            if (ack.err) console.error(ack.err)
          })
      }

      user
        .get("public")
        .get("groups")
        .get(enc(groupName))
        .put(data, ack => {
          if (ack.err) {
            setDisabledButton(false)
            setMessage("Could not update group")
            console.error(ack.err)
            clearInterval(interval)
            return
          }

          clearInterval(interval)
          done()
        })
      if (retry > 5) {
        setDisabledButton(false)
        setMessage("Could not update group")
        clearInterval(interval)
      }
      retry++
    }, 1000)
  }

  return (
    <Container maxWidth="md">
      <Grid container>
        <Grid item xs={12}>
          <Card sx={{mt: 2}}>
            <CardContent>
              <Typography variant="h5">Edit group</Typography>
              <TextField
                id="editgroup-name"
                label="Group name"
                variant="outlined"
                fullWidth={true}
                margin="normal"
                value={groupName}
                onChange={event => setGroupName(event.target.value)}
              />
              <Button
                sx={{mt: 1}}
                variant="contained"
                disabled={groupName === "" || disabledButton}
                onClick={updateGroup}
              >
                Submit
              </Button>
              {selected.length > 0 && !message && (
                <Typography sx={{m: 1}} variant="string">
                  {`Adding ${selected.length} feed${selected.length > 1 ? "s" : ""}`}
                </Typography>
              )}
              {message && (
                <Typography sx={{m: 1}} variant="string">
                  {message}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Typography sx={{m: 1}}>Current feeds</Typography>
        <Grid item xs={12}>
          <List>
            {feeds &&
              feeds.all.map(
                f =>
                  f.title &&
                  group.feeds.includes(f.key) && (
                    <Feed
                      user={user}
                      groups={groups}
                      currentGroup={currentGroup}
                      feed={f}
                      selected={false}
                      selectFeed={() => {}}
                    />
                  ),
              )}
          </List>
        </Grid>
        <Typography sx={{m: 1}}>Add feeds</Typography>
        <Grid item xs={12}>
          <List>
            {feeds &&
              feeds.all.map(
                f =>
                  f.title &&
                  !group.feeds.includes(f.key) && (
                    <Feed
                      user={user}
                      groups={groups}
                      feed={f}
                      selected={selected.includes(f.key)}
                      selectFeed={selectFeed}
                    />
                  ),
              )}
          </List>
        </Grid>
      </Grid>
    </Container>
  )
}

export default EditGroup
