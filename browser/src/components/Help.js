import { useState, useEffect } from "react"
import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"
import SearchAppBar from "./SearchAppBar"

const Help = ({loggedIn, host, mode, setMode}) => {
  const [help, setHelp] = useState("")

  useEffect(() => {
    if (!host) return

    host.get("help").once(data => {
      if (!data) return

      setHelp(data.content)
    }, {wait: 0})
  }, [host])

  return (
    <>
    {loggedIn && <SearchAppBar mode={mode} setMode={setMode}/>}
    <Container maxWidth="sm">
      <Grid container spacing={5}>
        <Grid item xs={12}>
          <Card>
            <Box>
              <Typography>{help}</Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Container>
    </>  
  )
}

export default Help
