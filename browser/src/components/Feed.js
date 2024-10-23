import Avatar from "@mui/material/Avatar"
import IconButton from "@mui/material/IconButton"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import CheckIcon from "@mui/icons-material/Check"
import DeleteIcon from "@mui/icons-material/Delete"
import PersonIcon from "@mui/icons-material/Person"
import {enc} from "../utils/text.js"

const Feed = ({user, groups, currentGroup, feed, selected, selectFeed}) => {
  const deleteFeed = feed => {
    user
      .get("public")
      .get("feeds")
      .get(enc(feed.key))
      .put(null, ack => {
        if (ack.err) console.error(ack.err)
      })
  }

  const updateGroupFeeds = feeds => {
    user
      .get("public")
      .get("groups")
      .get(enc(currentGroup))
      .get("feeds")
      .put(
        feeds.reduce((acc, feed) => {
          // This function converts selected feeds to an object to store in gun.
          // see Display useEffect which converts back to an array.
          return {...acc, [enc(feed)]: ""}
        }, {}),
        ack => {
          if (ack.err) console.error(ack.err)
        },
      )
  }

  const showDelete = feed => {
    // showDelete has two actions, if currentGroup is set then removing a feed
    // from that group, otherwise removing the feed for the user.
    if (currentGroup) {
      const group = groups.all.find(g => g.key === currentGroup)
      if (group.feeds.includes(feed.key)) {
        return (
          <IconButton
            edge="end"
            aria-label="delete"
            onClick={() =>
              updateGroupFeeds(group.feeds.filter(f => f !== feed))
            }
          >
            <DeleteIcon />
          </IconButton>
        )
      }

      // Don't show a delete button if the feed is not in the current group.
      return
    }

    const count = groups.all.filter(g => g.feeds.includes(feed.key)).length
    if (!feed.defaultGroup && count === 0) {
      return (
        <IconButton
          edge="end"
          aria-label="delete"
          onClick={() => deleteFeed(feed)}
        >
          <DeleteIcon />
        </IconButton>
      )
    }
  }

  return (
    <ListItem
      key={feed.key}
      disablePadding
      alignItems="flex-start"
      secondaryAction={showDelete(feed)}
    >
      <ListItemButton onClick={() => selectFeed(feed)} selected={selected}>
        <ListItemAvatar>
          {feed.image ? (
            <Avatar alt={`Avatar for ${feed.title}`} src={feed.image} />
          ) : (
            <Avatar>
              <PersonIcon />
            </Avatar>
          )}
        </ListItemAvatar>
        <ListItemText
          primary={feed.title}
          secondary={feed.html_url !== "" ? feed.html_url : feed.key}
        />
        {selected && (
          <IconButton edge="end" aria-label="check">
            <CheckIcon />
          </IconButton>
        )}
      </ListItemButton>
    </ListItem>
  )
}

export default Feed
