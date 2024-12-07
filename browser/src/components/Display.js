import {useCallback, useEffect, useReducer, useRef, useState} from "react"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Typography from "@mui/material/Typography"
import {init, reducer} from "../utils/reducer.js"
import {enc, dec} from "../utils/text.js"
import AddFeed from "./AddFeed"
import EditGroup from "./EditGroup"
import FeedList from "./FeedList"
import GroupList from "./GroupList"
import ItemList from "./ItemList"
import SearchAppBar from "./SearchAppBar"

const Display = ({host, user, code, mode, setMode, feeds}) => {
  const sortByLatest = (a, b) => b.latest - a.latest
  const [groups, updateGroup] = useReducer(reducer(sortByLatest), init)
  const day = key => {
    const t = key ? new Date(+key) : new Date()
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
  }
  const twoWeeks = Date.now() - 1209600000
  const [groupList, setGroupList] = useState(true)
  const [groupItems, setGroupItems] = useState(new Map())
  const [group, setGroup] = useState(null)
  const [currentGroup, setCurrentGroup] = useState("")
  const [message, setMessage] = useState("")
  const [feedList, setFeedList] = useState(false)
  const [addFeed, setAddFeed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [groupsDone, setGroupsDone] = useState(false)
  const [currentKeys, setCurrentKeys] = useState([])
  const [newKeys, setNewKeys] = useState([])
  const [itemsCheck, setItemsCheck] = useState(false)
  const lastCheck = useRef(Date.now())
  const getDay = useRef(day())
  const daysLoaded = useRef([])

  const createGroup = () => {
    setGroupList(false)
    setCurrentGroup("")
    setFeedList(true)
    setAddFeed(false)
    setGroup(null)
    window.history.pushState(null, "")
  }

  const editGroup = groupName => {
    setGroupList(false)
    setCurrentGroup(groupName)
    setFeedList(false)
    setAddFeed(false)
    setGroup(null)
    window.history.pushState(null, "")
  }

  const createFeed = () => {
    setGroupList(false)
    setCurrentGroup("")
    setFeedList(true)
    setAddFeed(true)
    setGroup(null)
    window.history.pushState(null, "")
  }

  const showGroupList = () => {
    setGroupList(true)
    setCurrentGroup("")
    setFeedList(false)
    setAddFeed(false)
    setGroup(null)
  }

  // The above functions are all display modes of this component and avoid
  // rendering so that the item list doesn't need re-mapping which is slow.
  window.addEventListener("popstate", event => showGroupList())

  const resetGroup = useCallback(
    key => {
      if (!user || !key || !group || group.count === 0) return

      user
        .get("public")
        .get("groups")
        .get(enc(key))
        .get("count")
        .put(0, ack => {
          if (ack.err) console.error(ack.err)
        })
    },
    [user, group],
  )

  // Group stats (like unread count, latest item...) can be updated in both
  // group list mode and in the background while viewing a particular group.
  const setGroupStats = useCallback(
    groupStats => {
      if (!user) return

      groupStats.forEach((stats, key) => {
        if (!key || !stats || stats.latest === 0) return

        user
          .get("public")
          .get("groups")
          .get(enc(key))
          .put(stats, ack => {
            if (ack.err) console.error(ack.err)
          })
      })
    },
    [user],
  )

  // loadMoreItems is called if the current group has no items to display from
  // a more recent day, or when viewing a particular group and scrollback in the
  // item list triggers a call to this function.
  const loadMoreItems = useCallback(() => {
    if (!host || !groups || !groupsDone) return

    getDay.current -= 86400000
    // Make sure loadItems is only called once per day loaded.
    if (daysLoaded.current.includes(getDay.current)) return

    daysLoaded.current.push(getDay.current)
    setLoading(true)
    const mapDay = day => {
      const seen = new Set()
      host
        .get("items" + day)
        .map()
        .once((item, key) => {
          if (!item || !item.url || !key || seen.has(key)) return

          seen.add(key)
          const url = dec(item.url)
          groups.all.forEach(g => {
            if (!g.feeds.includes(url)) return

            setGroupItems(gi => {
              const itemKeys = new Set(gi.get(g.key))
              return new Map(gi.set(g.key, itemKeys.add(key)))
            })
          })
        })
    }
    mapDay(getDay.current)
    setTimeout(() => setItemsCheck(true), 5000)
  }, [host, groups, groupsDone])

  // Effect that sets a message if the user scrolls back two weeks in a group.
  useEffect(() => {
    if (!group || getDay.current > twoWeeks) return

    setLoading(false)
    const itemKeys = groupItems.get(group.key)
    if (!itemKeys || itemKeys.size === 0) {
      setMessage("No items found for group. Check back later!")
      return
    }

    if (itemKeys.size < 10) {
      // Edge case for only a few items in the group.
      setCurrentKeys(Array.from(itemKeys).sort((a, b) => b - a))
    }
    setMessage("No more items available for this group.")
  }, [group, groupItems, twoWeeks])

  // Effect that runs on page load, fetches items for the current day and sets
  // an interval to process new items every 5 seconds.
  useEffect(() => {
    if (!host || !groups || !groupsDone) return

    const today = day()
    if (daysLoaded.current.includes(today)) return

    daysLoaded.current.push(today)

    let keys = []
    const seen = new Set()
    let updateStats = false
    const groupStats = new Map()
    // Don't start new key checks until existing items have been loaded.
    lastCheck.current = Date.now() + 5000
    host
      .get("items" + today)
      .map()
      .once((item, key) => {
        if (!item || !item.url || !key || seen.has(key)) return

        seen.add(key)
        const url = dec(item.url)
        const now = Date.now()
        groups.all.forEach(g => {
          if (!g.feeds.includes(url)) return

          setGroupItems(gi => {
            const itemKeys = new Set(gi.get(g.key))
            return new Map(gi.set(g.key, itemKeys.add(key)))
          })
          // Also update group stats on page load. Stats are already handled
          // for new keys, so just need to check recent keys here.
          if (now < lastCheck.current && key > g.latest) {
            const stats = groupStats.get(g.key)
            const title = dec(item.title)
            const content = dec(item.content)
            const tag = /(<([^>]+)>)/g
            const text = title
              ? title.replace(tag, "")
              : content.replace(tag, "")
            groupStats.set(g.key, {
              count: stats ? stats.count + 1 : g.count + 1,
              latest: key,
              author: item.author,
              timestamp: item.timestamp,
              text: text.length > 200 ? enc(text.substring(0, 200)) : enc(text),
            })
            updateStats = true
          }
        })
        // map subscribes to new items, so once existing items have been
        // loaded push new item keys.
        if (key > lastCheck.current) keys.push(key)
      })
    setInterval(() => {
      lastCheck.current = Date.now()
      if (updateStats) {
        setGroupStats(groupStats)
        updateStats = false
      }
      setNewKeys(keys)
      keys = []
    }, 5000)
  }, [host, groups, groupsDone, setGroupStats])

  // Effect that runs when a group is selected, can flag itemsCheck straight
  // away if above processing is done otherwise waits for it to finish first.
  useEffect(() => {
    if (!group) {
      setMessage("")
      setLoading(false)
      setCurrentKeys([])
      return
    }

    // Push history when a group is selected so that back button returns to the
    // group list.
    window.history.pushState(null, "")

    let wait = 0
    if (lastCheck.current > Date.now()) {
      wait = lastCheck.current - Date.now()
      if (wait > 500) setLoading(true)
    }
    setTimeout(() => setItemsCheck(true), wait)
  }, [group])

  // Effect that sets current keys which ItemList.js uses to render items.
  useEffect(() => {
    if (!itemsCheck || !group) return

    setItemsCheck(false)

    const itemKeys = groupItems.get(group.key)
    // Call loadMoreItems if current day didn't provide enough items.
    if (!itemKeys || itemKeys.size < 10) {
      loadMoreItems()
    } else {
      setLoading(false)
      // Sort in descending order for existing items as older items don't
      // need to be processed until user scrolls back.
      setCurrentKeys(Array.from(itemKeys).sort((a, b) => b - a))
    }
  }, [group, groupItems, itemsCheck, loadMoreItems])

  // Initial effect to set up the existing groups for the user.
  useEffect(() => {
    if (!user) return

    user
      .get("public")
      .get("groups")
      .map()
      .once((g, name) => {
        if (!name) return

        if (!g) {
          updateGroup({
            key: dec(name),
            feeds: [],
            count: 0,
            latest: 0,
            text: "",
            author: "",
            timestamp: 0,
          })
          return
        }

        const userFeeds = user
          .get("public")
          .get("groups")
          .get(name)
          .get("feeds")
        userFeeds.once(async f => {
          let groupFeeds = []
          // Convert feeds object to an array, removing data added by gun.
          // See FeedList createGroup which converts the array to an object.
          if (f) {
            delete f._
            for (const url of Object.keys(f)) {
              if (!(await userFeeds.get(url).then())) continue

              groupFeeds.push(dec(url))
            }
          }
          updateGroup({
            key: dec(name),
            feeds: groupFeeds,
            count: g.count ?? 0,
            latest: g.latest ?? 0,
            text: dec(g.text),
            author: dec(g.author),
            timestamp: dec(g.timestamp),
          })
        })
        setTimeout(() => setGroupsDone(true), 3000)
      })
  }, [user])

  return (
    <>
      {user.is && (
        <SearchAppBar
          page="display"
          showGroupList={showGroupList}
          createGroup={createGroup}
          editGroup={editGroup}
          createFeed={createFeed}
          mode={mode}
          setMode={setMode}
          title={group ? group.key : ""}
        />
      )}
      {groupList && !group && (
        <GroupList user={user} groups={groups} setGroup={setGroup} />
      )}
      {currentGroup && (
        <EditGroup
          user={user}
          code={code}
          groups={groups}
          currentGroup={currentGroup}
          showGroupList={showGroupList}
        />
      )}
      {feedList && !addFeed && (
        <FeedList
          user={user}
          code={code}
          groups={groups}
          showGroupList={showGroupList}
        />
      )}
      {feedList && addFeed && (
        <AddFeed host={host} user={user} code={code} setAddFeed={setAddFeed} />
      )}
      {group && loading && (
        <Box sx={{display: "flex", justifyContent: "center", p: 4}}>
          <CircularProgress />
        </Box>
      )}
      <Box sx={{display: "flex", justifyContent: "center", p: 4}}>
        <Typography>{message}</Typography>
      </Box>
      <ItemList
        host={host}
        group={group}
        groups={groups}
        setGroupStats={setGroupStats}
        resetGroup={resetGroup}
        currentKeys={currentKeys}
        newKeys={newKeys}
        loading={loading}
        loadMoreItems={loadMoreItems}
        feeds={feeds}
      />
    </>
  )
}

export default Display
