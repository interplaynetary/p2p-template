import {useEffect, useReducer, useState} from "react"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import List from "@mui/material/List"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import {init, reducer} from "../utils/reducer.js"
import {
  nytFavicon,
  bbcFavicon,
  tcFavicon,
  wiredFavicon,
  espnFavicon,
  cbsFavicon,
} from "../images/favicons.js"
import Feed from "./Feed"

const EditGroup = ({user, code, groups, currentGroup, showGroupList}) => {
  const [group, setGroup] = useState(() => {
    groups.all.find(g => g.key === currentGroup)
  })
  const [groupName, setGroupName] = useState(currentGroup)
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState("")
  const [disabledButton, setDisabledButton] = useState(false)
  const [feeds, updateFeed] = useReducer(reducer(), init)

  useEffect(() => {
    if (!groups) return

    setGroup(groups.all.find(g => g.key === currentGroup))
  }, [groups, currentGroup])

  // This is copied from FeedList in case users have added default feeds to
  // a group which also need to be displayed here.
  useEffect(() => {
    updateFeed({
      key: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      title: "NYT > Top Stories",
      html_url: "https://www.nytimes.com",
      language: "en-us",
      image: nytFavicon,
      defaultGroup: "News",
    })
    updateFeed({
      key: "https://feeds.bbci.co.uk/news/world/rss.xml",
      title: "BBC News",
      html_url: "https://www.bbc.co.uk/news/world",
      language: "en-gb",
      image: bbcFavicon,
      defaultGroup: "News",
    })
    updateFeed({
      key: "https://techcrunch.com/feed",
      title: "TechCrunch",
      html_url: "https://techcrunch.com",
      language: "en-US",
      image: tcFavicon,
      defaultGroup: "Tech",
    })
    updateFeed({
      key: "https://www.wired.com/feed",
      title: "Wired",
      html_url: "https://www.wired.com",
      language: "en-US",
      image: wiredFavicon,
      defaultGroup: "Tech",
    })
    updateFeed({
      key: "https://www.espn.com/espn/rss/news",
      title: "www.espn.com - TOP",
      html_url: "https://www.espn.com",
      language: "en",
      image: espnFavicon,
      defaultGroup: "Sport",
    })
    updateFeed({
      key: "https://www.cbssports.com/rss/headlines",
      title: "CBSSports.com Headlines",
      html_url: "https://www.cbssports.com",
      language: "en-us",
      image: cbsFavicon,
      defaultGroup: "Sport",
    })
  }, [])

  useEffect(() => {
    if (!user) return

    const update = (f, url) => {
      if (!url) return

      updateFeed({
        key: url,
        title: f ? f.title : "",
        description: f ? f.description : "",
        html_url: f ? f.html_url : "",
        language: f ? f.language : "",
        image: f ? f.image : "",
      })
    }
    user.get("public").get("feeds").map().once(update)
    user.get("public").get("feeds").map().on(update)
  }, [user])

  const selectFeed = f => {
    if (selected.includes(f.key)) {
      setSelected(selected.filter(key => key !== f.key))
    } else {
      setSelected([...selected, f.key])
    }
  }

  const updateGroup = () => {
    if (!group) {
      setMessage("Group not set")
      return
    }
    if (!groupName) {
      setMessage("Group name required")
      return
    }

    const allFeeds = [...group.feeds, ...selected]
    if (allFeeds.length === 0) {
      const message = "Removing all feeds will remove the group. Continue?"
      if (!window.confirm(message)) return
    }

    setDisabledButton(true)
    setMessage("Updating group...")

    const data = {
      feeds: allFeeds.reduce((acc, f) => {
        // This function converts selected feeds to an object to store in gun.
        // see Display useEffect which converts back to an array.
        return f ? {...acc, [f]: true} : {...acc}
      }, {}),
      count: 0,
      latest: 0,
      text: "",
      author: "",
    }
    let retry = 0
    const interval = setInterval(() => {
      // Delete the old group if the name changes.
      if (group.key && group.key !== groupName) {
        user
          .get("public")
          .get("groups")
          .get(group.key)
          .put(
            {
              feeds: {},
              count: 0,
              latest: 0,
              text: "",
              author: "",
            },
            ack => {
              if (ack.err) console.error(ack.err)
            },
          )
      }
      user
        .get("public")
        .get("groups")
        .get(groupName)
        .put(data, ack => {
          if (ack.err) {
            setDisabledButton(false)
            setMessage("Could not update group")
            console.error(ack.err)
            clearInterval(interval)
            return
          }

          clearInterval(interval)
          showGroupList(true)
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
                      code={code}
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
                      code={code}
                      groups={groups}
                      currentGroup={currentGroup}
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
