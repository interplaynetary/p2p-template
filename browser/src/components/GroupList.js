import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import List from "@mui/material/List"
import Typography from "@mui/material/Typography"
import Group from "./Group"

const GroupList = ({user, groups, setGroup}) => {
  return (
    <Container maxWidth="md">
      <Grid container>
        <Grid item xs={12}>
          <List>
            {groups &&
              groups.all.map(g => <Group group={g} setGroup={setGroup} />)}
          </List>
          {groups && groups.all.length === 0 && (
            <Typography>
              Welcome to your group list page! Select <b>New group</b> from the
              account menu to create your first group.
            </Typography>
          )}
        </Grid>
      </Grid>
    </Container>
  )
}

export default GroupList
