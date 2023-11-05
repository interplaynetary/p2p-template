import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"
import { AccessTime } from "@mui/icons-material"

const Item = () => {
  return (
    <Grid item xs={6}>
      <Card>
        <Box sx={{display: "flex", alignItems: "center"}} padding={1}>
          <AccessTime/>
          <Typography variant="h2">Hello</Typography>
        </Box>
      </Card>
    </Grid>
  )
}

export default Item
