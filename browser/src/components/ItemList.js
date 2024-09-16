import {useCallback, useEffect, useReducer, useRef, useState} from "react"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import Item from "./Item"

const init = {all:[], keys:[]}
const reducer = (current, add) => {
  if (add.reset) return init
  return {
    all: current.keys.includes(add.key) ?
      current.all : [add, ...current.all].sort((a, b) => a.key - b.key),
    keys: [add.key, ...current.keys],
  }
}

const dec = t => t ? new TextDecoder().decode(Uint8Array.from(atob(t), e => e.codePointAt(0))) : ""

const ItemList = ({host, user, group, keys}) => {
  const [items, updateItem] = useReducer(reducer, init)
  const [newFrom, setNewFrom] = useState(0)
  const [groupKey, setGroupKey] = useState("")
  const [loadTime] = useState(Date.now())
  const itemListRef = useRef()
  const itemRefs = useRef(new Map())
  const last = useRef(Date.now())
  const loadMore = useRef(0)
  const watchStart = useRef()
  const watchEnd = useRef()

  const updateStart = useCallback(async (k) => {
    if (!host) {
      updateItem({reset: true})
      return
    }

    if (!watchStart.current) {
      watchStart.current = new IntersectionObserver(e => {
        if (e[0].isIntersecting) {
          updateStart(k)
        }
      })
    }
    // Stop watching the current loadMore key.
    let target = itemRefs.current.get(loadMore.current)
    if (target) watchStart.current.unobserve(target)
    loadMore.current = 0

    let updated = 0
    let remove = 0
    for (const key of k) {
      if (updated === 10) break

      remove++
      let item = await host.get("items").get(key).then()
      if (!item) continue

      // Group feeds are decoded in Display.js
      if (!group.feeds.includes(dec(item.url))) continue

      // Find a new key that is between the current scroll position and the
      // last item to be loaded.
      if (updated++ < 5) {
        loadMore.current = key
      }
      updateItem({
        key,
        title: dec(item.title),
        content: dec(item.content),
        author: dec(item.author),
        category: dec(item.category),
        enclosure: dec(item.enclosure),
        permalink: dec(item.permalink),
        guid: dec(item.guid),
        timestamp: dec(item.timestamp),
        url: dec(item.url),
      })
    }
    k.splice(0, remove)
    // Wait for the ref to be added for the new loadMore item.
    setTimeout(() => {
      let target = itemRefs.current.get(loadMore.current)
      if (target) {
        watchStart.current.observe(target)
      }
    }, 100)
    // Scroll to the end when the group is first displayed.
    if (loadTime > Date.now() - 3000) {
      itemListRef.current.scrollIntoView({block: "end"})
    }
  }, [host, group, loadTime])

  const updateEnd = useCallback(async (newKeys) => {
    if (!host) {
      updateItem({reset: true})
      return
    }

    if (!watchEnd.current) {
      watchEnd.current = new IntersectionObserver(e => {
        if (e[0].isIntersecting) {
          setNewFrom(0)
        }
      })
    }
    let earliest = 0
    let latest = 0
    for (const key of newKeys) {
      if (key <= last.current) break

      let item = await host.get("items").get(key).then()
      if (!item) continue

      // Group feeds are decoded in Display.js
      if (!group.feeds.includes(dec(item.url))) continue

      updateItem({
        key,
        title: dec(item.title),
        content: dec(item.content),
        author: dec(item.author),
        category: dec(item.category),
        enclosure: dec(item.enclosure),
        permalink: dec(item.permalink),
        guid: dec(item.guid),
        timestamp: dec(item.timestamp),
        url: dec(item.url),
      })
      if (key < earliest || earliest === 0) earliest = key
      // newKeys is in descending order so can set latest from first key.
      if (latest === 0) latest = key
    }
    if (earliest !== 0 && newFrom === 0) {
      // If there is no current newFrom marker then mark as new from
      // earliest, the marker will be removed when scrolled to the end.
      setNewFrom(earliest)
    }
    if (latest !== 0) {
      // Stop watching the current last key.
      let target = itemRefs.current.get(last.current)
      if (target) watchEnd.current.unobserve(target)
      last.current = latest
      if (user && latest > group.updated) {
        user.get("public").get("groups").get(group.key).get("updated").put(latest)
      }
      // Wait for the ref to be added for the new last item.
      setTimeout(() => {
        let target = itemRefs.current.get(latest)
        if (target) {
          watchEnd.current.observe(target)
        }
      }, 100)
    }
  }, [host, user, group, newFrom])

  useEffect(() => {
    if (!host || !group || groupKey === group.key) return

    setGroupKey(group.key)
    updateStart(keys)
    host.get("items").on(items => {
      if (!items) return

      delete items._
      updateEnd(Object.keys(items).sort((a, b) => b - a))
    })
  }, [host, group, groupKey, keys, updateStart, updateEnd])

  return (
    <Container maxWidth="md">
      <Grid container ref={itemListRef}>
        {items && items.all.map(i => <Item
                                       key={i.key}
                                       item={i}
                                       itemRefs={itemRefs}
                                       newFrom={newFrom}
                                     />)}
      </Grid>
    </Container>
  )
}

export default ItemList
