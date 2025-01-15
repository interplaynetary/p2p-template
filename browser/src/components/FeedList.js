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

// TODO: Display a filtered list using the search bar.
const FeedList = ({user, code, groups, showGroupList}) => {
  const [groupName, setGroupName] = useState("")
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState("")
  const [disabledButton, setDisabledButton] = useState(false)
  const [hideDefaultFeeds, setHideDefaultFeeds] = useState(false)
  const [delay, setDelay] = useState(true)
  const [feeds, updateFeed] = useReducer(reducer(), init)
  const defaultGroups = ["News", "Tech", "Sport"]

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
    setTimeout(() => setDelay(false), 1000)
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

    user
      .get("public")
      .get("settings")
      .get("hideDefaultFeeds")
      .once(setHideDefaultFeeds)
  }, [user])

  const dismissDefaults = () => {
    user
      .get("public")
      .get("settings")
      .get("hideDefaultFeeds")
      .put(true, ack => {
        if (ack.err) {
          console.error(ack.err)
          return
        }

        setHideDefaultFeeds(true)
      })
  }

  const selectFeed = feed => {
    if (selected.includes(feed.key)) {
      setSelected(selected.filter(key => key !== feed.key))
    } else {
      setSelected([...selected, feed.key])
    }
  }

  const createGroup = () => {
    setDisabledButton(true)
    setMessage("Creating group...")

    const group = {
      feeds: selected.reduce((acc, f) => {
        // This function converts selected feeds to an object to store in gun.
        // see Display useEffect which converts back to an array.
        return f ? {...acc, [f]: true} : {...acc}
      }, {}),
      // Show an unread count for the group and display the author, text and
      // timestamp of the latest item. (latest field is the item key.)
      count: 0,
      latest: 0,
      text: "",
      author: "",
      timestamp: Date.now(),
    }
    let retry = 0
    const interval = setInterval(() => {
      if (!groupName) {
        setDisabledButton(false)
        setMessage("Group name required")
        clearInterval(interval)
        return
      }

      user
        .get("public")
        .get("groups")
        .get(groupName)
        .put(group, ack => {
          if (ack.err) {
            setDisabledButton(false)
            setMessage("Could not create group")
            console.error(ack.err)
            clearInterval(interval)
            return
          }

          clearInterval(interval)
          showGroupList(true)
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
          <Card sx={{mt: 2}}>
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
                sx={{mt: 1}}
                variant="contained"
                disabled={
                  selected.length === 0 || groupName === "" || disabledButton
                }
                onClick={createGroup}
              >
                Submit
              </Button>
              {selected.length > 0 && !message && (
                <Typography sx={{m: 1}} variant="string">
                  {`${selected.length} feed${selected.length > 1 ? "s" : ""} selected`}
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
        <Grid item xs={12}>
          <List>
            {feeds &&
              feeds.all.map(
                f =>
                  f.title &&
                  !f.defaultGroup && (
                    <Feed
                      user={user}
                      code={code}
                      groups={groups}
                      feed={f}
                      selected={selected.includes(f.key)}
                      selectFeed={selectFeed}
                    />
                  ),
              )}
          </List>
        </Grid>
        {!hideDefaultFeeds && !delay && (
          <Grid item xs={12}>
            <Typography>
              Looking for feeds? Click add feed in the menu, or try some of the
              options below.
            </Typography>
          </Grid>
        )}
        {!hideDefaultFeeds &&
          !delay &&
          defaultGroups.map(
            defaultGroup =>
              feeds &&
              feeds.all.filter(f => f.title && f.defaultGroup === defaultGroup)
                .length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6">{defaultGroup}</Typography>
                  <List>
                    {feeds &&
                      feeds.all.map(
                        f =>
                          f.title &&
                          f.defaultGroup === defaultGroup && (
                            <Feed
                              user={user}
                              code={code}
                              groups={groups}
                              feed={f}
                              selected={selected.includes(f.key)}
                              selectFeed={selectFeed}
                            />
                          ),
                      )}
                  </List>
                </Grid>
              ),
          )}
        {!hideDefaultFeeds && !delay && (
          <Grid item xs={12}>
            <Button sx={{mt: 1}} variant="contained" onClick={dismissDefaults}>
              Dismiss Defaults
            </Button>
          </Grid>
        )}
      </Grid>
    </Container>
  )
}

export default FeedList
