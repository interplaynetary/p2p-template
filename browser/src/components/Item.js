import parse from "html-react-parser"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Divider from "@mui/material/Divider"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"

const Item = ({item, itemRefs, newFrom}) => {
  return (
    <Grid item xs={12} ref={node => {
      if (node) {
        itemRefs.current.set(item.key, node)
      } else {
        itemRefs.current.delete(item.key)
      }
    }}>
      <Card>
        <Box>
          <Typography variant="h4">{item.title}</Typography>
          <Typography>{item.content && parse(item.content)}</Typography>
          <Typography>{item.key}</Typography>
          {item.key === newFrom && <Divider textAlign="right">New</Divider>}
        </Box>
      </Card>
    </Grid>
  )
}

export default Item
