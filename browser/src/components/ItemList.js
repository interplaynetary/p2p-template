import {useCallback, useEffect, useReducer, useRef, useState} from "react"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import {dec} from "../utils/text.js"
import {init, reducer} from "../utils/reducer.js"
import Item from "./Item"

const ItemList = ({host, group, groups, setGroupStats, resetGroup, currentKeys, newKeys}) => {
  const [items, updateItem] = useReducer(reducer(), init)
  const [newFrom, setNewFrom] = useState(0)
  const [groupKey, setGroupKey] = useState("")
  const loadTime = useRef(Date.now())
  const itemListRef = useRef()
  const itemRefs = useRef(new Map())
  const lastKey = useRef(Date.now())
  const loadMore = useRef(0)
  const watchStart = useRef()
  const watchEnd = useRef()

  const updateStart = useCallback(async (keys) => {
    let updated = 0
    let remove = 0
    if (!watchStart.current) {
      watchStart.current = new IntersectionObserver(e => {
        if (e[0].isIntersecting) {
          updateStart(keys)
        }
      })
    }
    // Stop watching the current loadMore key.
    const target = itemRefs.current.get(loadMore.current)
    if (target) watchStart.current.unobserve(target)
    loadMore.current = 0
    for (const key of keys) {
      if (updated === 10) break

      remove++
      const item = await host.get("items").get(key).then()
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
    keys.splice(0, remove)
    // Wait for the ref to be added for the new loadMore item.
    setTimeout(() => {
      const target = itemRefs.current.get(loadMore.current)
      if (target) {
        watchStart.current.observe(target)
      }
    }, 100)
    // Scroll to the end when the group is first displayed.
    if (loadTime.current > Date.now() - 3000) {
      itemListRef.current.scrollIntoView({block: "end"})
    }
  }, [host, group])

  const updateEnd = useCallback(async (keys) => {
    if (keys.length === 0) return

    let earliest = 0
    let latest = 0
    // Update stats for all groups.
    const groupStats = new Map()
    groups.all.forEach(g => groupStats.set(g.key, {
      count: g.key !== group.key ? g.count : 0,
      latest: 0,
      text: "",
      author: "",
    }))
    if (!watchEnd.current) {
      watchEnd.current = new IntersectionObserver(e => {
        if (e[0].isIntersecting) {
          setNewFrom(0)
        }
      })
    }
    for (const key of keys) {
      const item = await host.get("items").get(key).then()
      if (!item) continue

      // Group feeds are decoded in Display.js
      const url = dec(item.url)
      groups.all.forEach(g => {
        if (!g.feeds.includes(url)) return

        let stats = groupStats.get(g.key)
        if (stats.latest === 0) {
          stats.latest = key
          stats.text = item.content
          stats.author = item.author
        }
        if (g.key !== group.key) stats.count++
        groupStats.set(g.key, stats)
      })
      if (!group.feeds.includes(url)) continue

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
      // keys are in descending order so can set latest from first key.
      if (latest === 0) latest = key
    }
    if (earliest !== 0 && newFrom === 0) {
      // If there is no current newFrom marker then mark as new from
      // earliest, the marker will be removed when scrolled to the end.
      setNewFrom(earliest)
    }
    if (latest !== 0) {
      // Stop watching the current last key.
      const target = itemRefs.current.get(lastKey.current)
      if (target) watchEnd.current.unobserve(target)
      lastKey.current = latest
      // Wait for the ref to be added for the new last item.
      setTimeout(() => {
        const target = itemRefs.current.get(latest)
        if (target) {
          watchEnd.current.observe(target)
        }
      }, 100)
    }
    setGroupStats(groupStats)
  }, [host, group, groups, setGroupStats, newFrom])

  useEffect(() => {
    if (!host || !group) {
      updateItem({reset: true})
      return
    }

    // Only update here when the group changes.
    if (groupKey === group.key) return

    setGroupKey(group.key)
    updateStart(currentKeys)
    resetGroup(group.key)
  }, [host, group, groupKey, currentKeys, updateStart, resetGroup])

  useEffect(() => {
    if (!host || !group) {
      updateItem({reset: true})
      return
    }

    updateEnd(newKeys)
  }, [host, group, newKeys, updateEnd])

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
