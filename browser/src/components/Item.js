import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"

const Item = ({item}) => {
  return (
    <Grid item xs={12}>
      <Card>
        <Box>
          <Typography variant="h4">{item.title}</Typography>
          <Typography>{item.content}</Typography>
          <Typography>{new Date(item.timestamp).toDateString()}</Typography>
        </Box>
      </Card>
    </Grid>
  )
}

export default Item
