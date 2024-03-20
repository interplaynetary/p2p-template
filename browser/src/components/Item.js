import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"

const Item = ({message}) => {
  return (
      <Grid item xs={12}>
      <Card>
        <Box>
          <Typography variant="h4">{message.name}</Typography>
          <Typography>From: {message.message}</Typography>
          <Typography>Date: {message.createdAt}</Typography>
        </Box>
      </Card>
    </Grid>
  )
}

export default Item
