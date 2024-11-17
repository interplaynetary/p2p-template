import parse from "html-react-parser"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import Grid from "@mui/material/Grid"
import Link from "@mui/material/Link"
import Typography from "@mui/material/Typography"

// TODO: Add locale support.
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h12",
})

const Item = ({item, itemRefs, newFrom}) => {
  const formatDate = key => {
    const p = formatter.formatToParts(key)
    return `${p[0].value} ${p[2].value} ${p[4].value}${p[5].value}${p[6].value}${p[8].value}`
  }

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
        <Typography>{item.author}</Typography>
        <Link href={item.permalink} target="_blank">
          {formatDate(item.timestamp)}
        </Link>
        <Typography variant="h6">{item.title && parse(item.title)}</Typography>
        <Typography>{item.content && parse(item.content)}</Typography>
      </Box>
    </Grid>
  )
}

export default Item
