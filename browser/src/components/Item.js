import {useState} from "react"
import parse from "html-react-parser"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import Grid from "@mui/material/Grid"
import Link from "@mui/material/Link"
import Typography from "@mui/material/Typography"
import PersonIcon from "@mui/icons-material/Person"
import {formatDate} from "../utils/format.js"

const toColor = url => {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = url.charCodeAt(i) + ((hash << 5) - hash)
  }

  let color = "#"
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xff
    if (value > 80) value -= 80
    color += `00${value.toString(16)}`.slice(-2)
  }
  return color
}

const urlAvatar = url => {
  return {
    sx: {
      bgcolor: toColor(url),
    },
    children: url.match(/https?:\/\/(?:www\.)(.)/)[0],
  }
}

const Item = ({item, itemRefs, newFrom}) => {
  const [showMore, setShowMore] = useState(false)

  return (
    <Grid
      item
      xs={12}
      ref={node => {
        if (node) {
          itemRefs.current.set(item.key, node)
        } else {
          itemRefs.current.delete(item.key)
        }
      }}
    >
      {item.key === newFrom && <Divider textAlign="right">New</Divider>}
      <Box sx={{pt: 2}}>
        <Box sx={{display: "flex"}}>
          {item.feedImage ? (
            <Avatar alt={`Avatar for ${item.feedTitle}`} src={item.feedImage} />
          ) : item.feedUrl ? (
            <Avatar {...urlAvatar(item.feedUrl)} />
          ) : (
            <Avatar>
              <PersonIcon />
            </Avatar>
          )}
          <Typography
            variant="h6"
            sx={{
              ml: 2,
              flexGrow: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.author ? item.author : item.feedTitle}
          </Typography>
          <Link
            href={item.permalink}
            target="_blank"
            variant="body2"
            sx={{mt: 1, whiteSpace: "nowrap"}}
          >
            {formatDate(item.timestamp)}
          </Link>
        </Box>
        {item.title && (
          <Typography>
            <b>{parse(item.title)}</b>
          </Typography>
        )}
        {item.content && item.content.length > 1200 && showMore && (
          <Typography>
            {parse(item.content)}{" "}
            <Link
              component="button"
              onClick={() => {
                setShowMore(false)
              }}
            >
              show less
            </Link>
          </Typography>
        )}
        {item.content && item.content.length > 1200 && !showMore && (
          <Typography>
            {item.content.replace(/(<([^>]+)>)/g, "").substring(0, 800)}...{" "}
            <Link
              component="button"
              onClick={() => {
                setShowMore(true)
              }}
            >
              show more
            </Link>
          </Typography>
        )}
        {item.content && item.content.length <= 1200 && (
          <Typography>{parse(item.content)}</Typography>
        )}
      </Box>
    </Grid>
  )
}

export default Item
