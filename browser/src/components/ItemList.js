import {useEffect, useReducer, useState} from "react"
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

const ItemList = ({host, user, group}) => {
  const [items, updateItem] = useReducer(reducer, init)
  const [itemUrls, setItemUrls] = useState(new Map())
  const [keys, setKeys] = useState([])
  const [first, setFirst] = useState(0)
  const [last, setLast] = useState(Date.now())
  const [newest, setNewest] = useState(0)
  const [newAfter, setNewAfter] = useState(0)
  const closest = (a, n) => a.reduce((prv, cur) => Math.abs(cur-n) < Math.abs(prv-n) ? cur : prv)

  useEffect(() => {
    if (!host) return

    let set = false
    const updatedUrls = new Map()
    host.get("items").map().on((item, key) => {
      if (item) {
        updatedUrls.set(key, item.url)
      } else {
        updatedUrls.delete(key)
      }
      set = true
    })
    // Batch item updates.
    setInterval(() => {
      if (!set) return

      setItemUrls(updatedUrls)
      const updatedKeys = Array.from(updatedUrls.keys())
      // Sort keys into ascending order.
      updatedKeys.sort()
      setKeys(updatedKeys)
      set = false
    }, 1000)
  }, [host])

  useEffect(() => {
    // If newest timestamp is greater than the last displayed item then mark
    // the items as new from that point.
    if (newest > last) {
      setNewAfter(last)
    }
    if (newest > group.updated) {
      user.get("public").get("groups").get(group.key).get("updated").put(newest)
    }
  }, [group, user, newest, last])

  useEffect(() => {
    if (!host || !user || !group || keys.length === 0) {
      updateItem({reset: true})
      return
    }

    const updateItemList = (start, end) => {
      start = closest(keys, start)
      let current = start
      let i = keys.indexOf(start)
      while (current < end) {
        current = keys[i++]
        if (!group.feeds.includes(itemUrls.get(current))) continue

        host.get("items").get(current).once((item, key) => {
          if (!item) return

          delete item._
          updateItem({key, ...item})
        }, {wait: 0})
      }
      // current is the newest timestamp between start and end.
      return current
    }

    let retry = 1
    let start = group.start
    setNewest(updateItemList(start, Date.now()))
    // Check if older items should be displayed. Get items before the first
    // displayed item, using larger time spans with each retry.
    while (start > first && start > 0) {
      let end = start
      start -= 60000 * retry
      if (start < 0) start = 0
      updateItemList(start, end)
      retry *= 10
    }
    if (start !== group.start) {
      user.get("public").get("groups").get(group.key).get("start").put(start)
    }
  }, [host, user, group, itemUrls, keys, first])

  return (
    <Container maxWidth="md">
      <Grid container>
        {items && items.all.map(i => <Item
                                       key={i.key}
                                       item={i}
                                       first={first}
                                       setFirst={setFirst}
                                       last={last}
                                       setLast={setLast}
                                       newAfter={newAfter}
                                     />)}
      </Grid>
    </Container>
  )
}

export default ItemList
