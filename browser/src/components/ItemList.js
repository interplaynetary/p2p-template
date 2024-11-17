import {useCallback, useEffect, useReducer, useRef, useState} from "react"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import {dec} from "../utils/text.js"
import {init, reducer} from "../utils/reducer.js"
import Item from "./Item"

const ItemList = ({
  host,
  group,
  groups,
  setGroupStats,
  resetGroup,
  currentKeys,
  newKeys,
  loading,
}) => {
  const [items, updateItem] = useReducer(reducer(), init)
  const [newFrom, setNewFrom] = useState(0)
  const [groupKey, setGroupKey] = useState("")
  const itemListRef = useRef()
  const itemRefs = useRef(new Map())
  const lastKey = useRef(Date.now())
  const loadMore = useRef(0)
  const watchStart = useRef()
  const watchEnd = useRef()
  const interval = useRef(0)

  const updateStart = useCallback(
    async keys => {
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
        if (!key) continue

        const item = await host.get("items").get(key).then()
        if (!item) continue

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
    },
    [host],
  )

  useEffect(() => {
    if (loading) return

    let retry = 0
    clearInterval(interval.current)
    interval.current = setInterval(() => {
      if (retry++ > 5) {
        clearInterval(interval.current)
      }
      if (itemListRef.current) {
        itemListRef.current.scrollIntoView({block: "end"})
      }
    }, 500)
  }, [loading])

  useEffect(() => {
    if (!host || !group || currentKeys.length === 0) {
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
    // Display module updates stats when group is not set.
    if (!host || !group || newKeys.length === 0) return

    const groupStats = new Map()
    groups.all.forEach(g =>
      groupStats.set(g.key, {
        count: g.key !== group.key ? g.count : 0,
        latest: 0,
        text: "",
        author: "",
      }),
    )
    if (!watchEnd.current) {
      watchEnd.current = new IntersectionObserver(e => {
        if (e[0].isIntersecting) {
          setNewFrom(0)
        }
      })
    }
    let earliest = 0
    let latest = 0
    newKeys.forEach(async key => {
      if (!key) return

      const item = await host.get("items").get(key).then()
      if (!item) return

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
      if (!group.feeds.includes(url)) return

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
    })
    // The above forEach is async so wait for it to finish.
    setTimeout(() => {
      if (earliest !== 0 && newFrom === 0) {
        // If there is no current newFrom marker then mark as new from
        // earliest, the marker will be removed when scrolled to the end.
        setNewFrom(earliest)
      }
      if (latest !== 0) {
        // Stop watching the current last key.
        const currentTarget = itemRefs.current.get(lastKey.current)
        if (currentTarget) watchEnd.current.unobserve(currentTarget)
        lastKey.current = latest
        const newTarget = itemRefs.current.get(latest)
        if (newTarget) {
          watchEnd.current.observe(newTarget)
        }
      }
      setGroupStats(groupStats)
    }, 1000)
  }, [host, group, groups, newKeys, setGroupStats, newFrom])

  return (
    <Container maxWidth="md">
      <Grid container ref={itemListRef}>
        {items &&
          items.all.map(i => (
            <Item key={i.key} item={i} itemRefs={itemRefs} newFrom={newFrom} />
          ))}
      </Grid>
    </Container>
  )
}

export default ItemList
