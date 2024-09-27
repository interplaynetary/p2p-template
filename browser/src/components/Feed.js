import Avatar from "@mui/material/Avatar"
import IconButton from "@mui/material/IconButton"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import CheckIcon from "@mui/icons-material/Check"
import PersonIcon from "@mui/icons-material/Person"

const Feed = ({feed, selected, selectItem}) => {
  return (
    <ListItem
      key={feed.key}
      disablePadding
      alignItems="flex-start"
      onClick={() => selectItem(feed)}
    >
      <ListItemButton selected={selected}>
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
