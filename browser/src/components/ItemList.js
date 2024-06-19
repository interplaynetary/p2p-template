import {useEffect, useReducer} from "react"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import Item from "./Item"

const init = {all:[], keys:[]}
const reducer = (current, add) => {
  if (add.reset) return init
  return {
    all: current.keys.includes(add.key) ? current.all : [add, ...current.all],
    keys: [add.key, ...current.keys],
  }
}

const ItemList = ({host, group}) => {
  const [items, updateItem] = useReducer(reducer, init)

  useEffect(() => {
    if (!host || !group) return

    updateItem({reset: true})
    // Need to get items at a specific timestamp and paginate here, then
    // for each item filter by each feed in the current group. (Pass the
    // timestamp in as a dependency to useEffect...)
    host.get("items").map().once((item, key) => {
      if (group.feeds.includes(item.xml_url)) {
        updateItem({key, ...item})
      }
    }, {wait: 0})
  }, [host, group])

  return (
    <Container maxWidth="md">
      <Grid container>
        {items && items.all.map(item => <Item key={item.key} item={item}/>)}
      </Grid>
    </Container>
  )
}

export default ItemList
