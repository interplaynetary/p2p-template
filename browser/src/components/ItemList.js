import {useEffect, useReducer, useRef, useState} from "react"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import {enc, dec} from "../utils/text.js"
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
  loadMoreItems,
  feeds,
}) => {
  const [items, updateItem] = useReducer(reducer(), init)
  const [groupKey, setGroupKey] = useState("")
  const [newFrom, setNewFrom] = useState(0)
  const [scrollOnce, setScrollOnce] = useState(false)
  const [updateStart, setUpdateStart] = useState(false)
  const itemListRef = useRef()
  const itemRefs = useRef(new Map())
  const firstKeyIndex = useRef(0)
  const loadKeyIndex = useRef(10)
  const lastKey = useRef(Date.now())
  const loadMore = useRef(0)
  const watchStart = useRef()
  const watchEnd = useRef()

  const day = key => {
    const t = key ? new Date(+key) : new Date()
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
  }

  // Wait for enough items for the scroll bar to appear and then scroll to the
  // end once so that the intersection observer is not automatically triggered.
  useEffect(() => {
    if (scrollOnce || items.all.length < 10) return

    setScrollOnce(true)
    if (itemListRef.current) {
      itemListRef.current.scrollIntoView({block: "end"})
    }
  }, [scrollOnce, items])

  useEffect(() => {
    if (!updateStart) return

    setUpdateStart(false)

    const update = async () => {
      // Stop watching the current target item.
      const target = itemRefs.current.get(loadMore.current)
      if (target && watchStart.current) watchStart.current.unobserve(target)

      while (firstKeyIndex.current < loadKeyIndex.current) {
        if (firstKeyIndex.current >= currentKeys.length) break

        const key = currentKeys[firstKeyIndex.current++]
        if (!key) continue

        const item = await host
          .get("items" + day(key))
          .get(key)
          .then()
        if (!item) continue

        const feed = feeds.get(item.url)
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
          feedUrl: feed && feed.url ? dec(feed.html_url) : "",
          feedTitle: feed && feed.title ? dec(feed.title) : "",
          feedImage: feed && feed.image ? dec(feed.image) : "",
          url: dec(item.url),
        })
      }
      // Wait for the ref to be added for the new loadMore item.
      setTimeout(() => {
        watchStart.current = new IntersectionObserver(e => {
          if (e[0].isIntersecting) {
            // Load 10 items before current first key.
            loadKeyIndex.current = firstKeyIndex.current + 10
            // currentKeys is the available keys for the group and itemRefs is
            // the items that have already been rendered.
            if (currentKeys.length - itemRefs.current.size <= 10) {
              loadMoreItems()
              // Wait for loadMoreItems to add to currentKeys.
              setTimeout(() => setUpdateStart(true), 6000)
            } else {
              setUpdateStart(true)
            }
          }
        })
        // Find a new target to trigger loading more items.
        for (let i = firstKeyIndex.current - 1; i > 0; i--) {
          const target = itemRefs.current.get(currentKeys[i])
          if (target) {
            watchStart.current.observe(target)
            loadMore.current = currentKeys[i]
            break
          }
        }
      }, 1000)
    }
    update()
  }, [host, updateStart, loadMoreItems, currentKeys, feeds])

  useEffect(() => {
    if (!group) {
      firstKeyIndex.current = 0
      loadKeyIndex.current = 10
      loadMore.current = 0
      updateItem({reset: true})
      setScrollOnce(false)
      setNewFrom(0)
      setGroupKey("")
      return
    }

    if (groupKey === group.key || currentKeys.length === 0) return

    setGroupKey(group.key)
    resetGroup(group.key)
    setUpdateStart(true)
  }, [group, groupKey, currentKeys, resetGroup])

  useEffect(() => {
    if (!host || !groups || newKeys.length === 0) return

    if (!watchEnd.current) {
      watchEnd.current = new IntersectionObserver(e => {
        if (e[0].isIntersecting) setNewFrom(0)
      })
    }

    const groupStats = new Map()
    groups.all.forEach(g =>
      groupStats.set(g.key, {
        count: !group || g.key !== group.key ? g.count : 0,
        latest: 0,
        text: "",
        author: "",
        timestamp: 0,
      }),
    )
    let earliest = 0
    let latest = 0
    newKeys.forEach(async key => {
      if (!key) return

      const item = await host
        .get("items" + day(key))
        .get(key)
        .then()
      if (!item) return

      // Group feeds are decoded in Display.js, so compare decoded.
      const url = dec(item.url)
      groups.all.forEach(g => {
        if (!g.feeds.includes(url)) return

        let stats = groupStats.get(g.key)
        if (key > stats.latest) {
          stats.latest = key
          stats.author = item.author
          stats.timestamp = item.timestamp
          const title = dec(item.title)
          const content = dec(item.content)
          const tag = /(<([^>]+)>)/g
          const text = title ? title.replace(tag, "") : content.replace(tag, "")
          stats.text =
            text.length > 200 ? enc(text.substring(0, 200)) : enc(text)
        }
        if (!group || g.key !== group.key) stats.count++
        groupStats.set(g.key, stats)
      })
      if (!group || !group.feeds.includes(url)) return

      // Feeds are mapped encoded in App.js
      const feed = feeds.get(item.url)
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
        feedUrl: feed && feed.url ? dec(feed.html_url) : "",
        feedTitle: feed && feed.title ? dec(feed.title) : "",
        feedImage: feed && feed.image ? dec(feed.image) : "",
        url: dec(item.url),
      })
      if (key < earliest || earliest === 0) earliest = key
      if (key > latest || latest === 0) latest = key
    })
    if (!group) return

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
        if (newTarget) watchEnd.current.observe(newTarget)
      }
      setGroupStats(groupStats)
    }, 5000)
  }, [host, group, groups, newKeys, setGroupStats, newFrom, feeds])

  return (
    <Container maxWidth="md">
      <Grid container ref={itemListRef}>
        {group &&
          items &&
          items.all.map(i => (
            <Item key={i.key} item={i} itemRefs={itemRefs} newFrom={newFrom} />
          ))}
      </Grid>
    </Container>
  )
}

export default ItemList
