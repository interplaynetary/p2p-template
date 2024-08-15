import Avatar from "@mui/material/Avatar"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import PersonIcon from "@mui/icons-material/Person"
import GroupIcon from "@mui/icons-material/Group"

const Group = ({group, setGroup}) => {
  // TODO: Display group.updated timestamp
  return (
    <ListItem
      key={group.key}
      disablePadding
      alignItems="flex-start"
      onClick={() => setGroup(group)}
    >
      <ListItemButton>
        <ListItemAvatar>
          {group.image ?
           <Avatar
             alt={`Avatar for ${group.name}`}
             src={group.image}
           /> :
           <Avatar>
             {group.feeds && group.feeds.length > 1 ?
              <GroupIcon/> : <PersonIcon/>}
           </Avatar>}
        </ListItemAvatar>
        <ListItemText primary={group.name}/>
      </ListItemButton>
    </ListItem>
  )
}

export default Group
