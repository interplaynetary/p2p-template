import {useEffect} from "react"
import parse from "html-react-parser"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"

const Item = ({item, first, setFirst, last, setLast, newAfter}) => {

  useEffect(() => {
    if (item.key < first) {
      setFirst(item.key)
    }
    if (item.key > last) {
      setLast(item.key)
    }
  }, [item, first, setFirst, last, setLast])

  // Also check if an item timestamp is ahead of the group.end cursor.
  // Need to put a line in with "New"... (then remove the line when cursor
  // catches up on scroll.)
  return (
    <Grid item xs={12}>
      <Card>
        <Box>
          <Typography variant="h4">{item.title}</Typography>
          <Typography>{parse(item.content)}</Typography>
          <Typography>{new Date(item.timestamp).toDateString()}</Typography>
          {newAfter === last && <Typography>-------NEW AFTER-----</Typography>}
        </Box>
      </Card>
    </Grid>
  )
}

export default Item
