import {useEffect, useReducer} from "react"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import Group from "./Group"
import List from "@mui/material/List"

const init = {all:[], keys:[]}
const reducer = (current, add) => {
  if (add.reset) return init
  return {
    all: current.keys.includes(add.key) ? current.all : [add, ...current.all],
    keys: [add.key, ...current.keys],
  }
}

const GroupList = ({user, setGroup}) => {
  const [groups, updateGroup] = useReducer(reducer, init)

  useEffect(() => {
    if (!user) return

    user.get("public").get("groups").map().once((group, key) => {
      if (!group) return

      user.get("public").get("groups").get(key).get("feeds").once(feeds => {
        if (!feeds) return

        // Convert feeds object to an array, removing data added by gun.
        // See FeedList createGroup which converts the array to an object.
        delete feeds._
        updateGroup({key, name: group.name, feeds: Object.keys(feeds)})
      }, {wait: 0})
    }, {wait: 0})
  }, [user])

  return (
    <Container maxWidth="md">
      <Grid container>
        <Grid item xs={12}>
          <List>
            {groups &&
             groups.all.map(group => <Group
                                       group={group}
                                       setGroup={setGroup}
                                     />)}
          </List>
        </Grid>
      </Grid>
    </Container>
  )
}

export default GroupList
