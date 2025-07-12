import {useCallback, useEffect, useReducer, useRef, useState} from "react"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Typography from "@mui/material/Typography"
import {init, reducer} from "../utils/reducer.js"
import AddFeed from "./AddFeed"
import EditGroup from "./EditGroup"
import FeedList from "./FeedList"
import GroupList from "./GroupList"
import ItemList from "./ItemList"
import SearchAppBar from "./SearchAppBar"

const Display = ({user, host, code, mode, setMode, feeds}) => {
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
  const [groupsLoaded, setGroupsLoaded] = useState([])
  const [groupCount, setGroupCount] = useState(0)
  const [currentKeys, setCurrentKeys] = useState([])
  const [newKeys, setNewKeys] = useState([])
  const [itemsCheck, setItemsCheck] = useState(false)
  const [updateStart, setUpdateStart] = useState(false)
  const lastCheck = useRef(Date.now())
  const getDay = useRef(day())
  const daysLoaded = useRef([])
  const updateStats = useRef(false)

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

  const showGroupList = reset => {
    if (reset) {
      window.location = "/"
      return
    }

    setGroupList(true)
    setCurrentGroup("")
    setFeedList(false)
    setAddFeed(false)
    setGroup(null)
  }

  // The above functions are all display modes of this component and avoid
  // rendering so that the item list doesn't need re-mapping which is slow.
  window.addEventListener("popstate", event => showGroupList(false))

  const resetGroup = useCallback(
    key => {
      if (!user || !key || !group || group.count === 0) return

      user
        .get("public")
        .next("groups")
        .next(key)
        .next("count")
        .put(0, err => {
          if (err) console.error(err)
        })
    },
    [user, group],
  )

  // Group stats (like unread count, latest item...) can be updated in both
  // group list mode and in the background while viewing a particular group.
  const setGroupStats = useCallback(
    groupStats => {
      if (!user) return

      groupStats.forEach(async (stats, key) => {
        if (!key || !stats || stats.latest === 0) return

        const err = await new Promise(res => {
          user.get("public").next("groups").next(key).put(stats, res)
        })
        if (err) console.error(err)
      })
    },
    [user],
  )

  // loadMoreItems is called if the current group has no items to display from
  // a more recent day, or when viewing a particular group and scrollback in the
  // item list triggers a call to this function.
  const loadMoreItems = useCallback(() => {
    if (!user || !host || !groups || getDay.current < twoWeeks) return

    getDay.current -= 86400000
    // Make sure loadItems is only called once per day loaded.
    if (daysLoaded.current.includes(getDay.current)) return

    daysLoaded.current.push(getDay.current)
    const seen = new Set()
    user.get([host, "items"]).next(getDay.current, items => {
      if (!items) {
        setItemsCheck(true)
        setUpdateStart(true)
        return
      }

      for (const [key, item] of Object.entries(items)) {
        if (!item || !item.url || !key || seen.has(key)) continue

        seen.add(key)
        groups.all.forEach(g => {
          if (!g.feeds.includes(item.url)) return

          setGroupItems(gi => {
            const itemKeys = new Set(gi.get(g.key))
            return new Map(gi.set(g.key, itemKeys.add(key)))
          })
        })
      }
      setItemsCheck(true)
      setUpdateStart(true)
    })
  }, [user, host, groups, twoWeeks])

  // Effect that sets a message if the user scrolls back two weeks in a group.
  useEffect(() => {
    if (!group || getDay.current >= twoWeeks) return

    setLoading(false)
    const itemKeys = groupItems.get(group.key)
    if (!itemKeys || itemKeys.size === 0) {
      setMessage("No items found for group. Check back later!")
      return
    }

    setMessage("No more items available for this group.")
  }, [group, groupItems, twoWeeks])

  // Effect that runs on page load, fetches items for the current day and sets
  // an interval to process new items every 10 seconds.
  useEffect(() => {
    if (!host || !groups) return
    if (groupCount === 0 || groupCount !== groupsLoaded.length) return

    const today = day()
    if (daysLoaded.current.includes(today)) return

    daysLoaded.current.push(today)

    let keys = []
    const seen = new Set()
    const groupStats = new Map()
    // Don't start new key checks until existing items have been loaded.
    lastCheck.current = Date.now() + 10000

    const update = items => {
      if (!items) return

      for (const [key, item] of Object.entries(items)) {
        if (!item || !item.url || !key || seen.has(key)) continue

        seen.add(key)
        const now = Date.now()
        groups.all.forEach(g => {
          if (!g.feeds.includes(item.url)) return

          setGroupItems(gi => {
            const itemKeys = new Set(gi.get(g.key))
            return new Map(gi.set(g.key, itemKeys.add(key)))
          })
          // Also update group stats on page load. Stats are already handled
          // for new keys, so just need to check recent keys here. (Exception
          // for new groups where latest hasn't been set yet.)
          if (!g.latest || (now < lastCheck.current && key > g.latest)) {
            const stats = groupStats.get(g.key)
            const tag = /(<([^>]+)>)/g
            const text = item.title
              ? item.title.replace(tag, "")
              : item.content.replace(tag, "")
            groupStats.set(g.key, {
              count: stats ? stats.count + 1 : g.count + 1,
              latest: key,
              author: item.author,
              timestamp: item.timestamp,
              text: text.length > 200 ? text.substring(0, 200) : text,
            })
            updateStats.current = true
          }
        })
        // on subscribes to new items, so once existing items have been
        // loaded push new item keys.
        if (key > lastCheck.current) {
          lastCheck.current = key
          keys.push(key)
        }
      }
    }
    // Wait for websocket to connect.
    setTimeout(() => {
      user.get([host, "items"]).next(today).on(update, true)
    }, 1000)
    setInterval(() => {
      if (updateStats.current) {
        setGroupStats(groupStats)
        updateStats.current = false
      }
      setNewKeys(keys)
      keys = []
    }, 10000)
  }, [user, host, groups, groupCount, groupsLoaded, setGroupStats])

  // Effect that runs when a group is selected, can flag itemsCheck straight
  // away if above processing is done otherwise waits for it to finish first.
  useEffect(() => {
    setMessage("")
    setCurrentKeys([])
    setItemsCheck(false)
    // Push history when a group is selected so that back button returns to the
    // group list.
    window.history.pushState(null, "")

    let wait = 500
    if (lastCheck.current > Date.now()) {
      wait = lastCheck.current - Date.now()
    }
    setLoading(true)
    setTimeout(() => setItemsCheck(true), wait)
  }, [group])

  // Effect that sets current keys which ItemList.js uses to render items.
  useEffect(() => {
    if (!itemsCheck || !group) return

    setItemsCheck(false)

    const itemKeys = groupItems.get(group.key)
    // Call loadMoreItems if current day didn't provide any items.
    if (!itemKeys || itemKeys.size === 0) {
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

    const update = (name, g) => {
      if (!name) return

      if (!g) {
        updateGroup({
          key: name,
          feeds: [],
          count: 0,
          latest: 0,
          text: "",
          author: "",
          timestamp: 0,
        })
        return
      }

      let groupFeeds = []
      if (g.feeds) {
        for (const [url, add] of Object.entries(g.feeds)) {
          if (add) groupFeeds.push(url)
        }
      }
      updateGroup({
        key: name,
        feeds: groupFeeds,
        count: g.count ?? 0,
        latest: g.latest ?? 0,
        text: g.text ?? "",
        author: g.author ?? "",
        timestamp: g.timestamp ?? 0,
      })
      setGroupsLoaded(gl => (gl.includes(name) ? gl : [...gl, name]))
    }
    // Wait for websocket to connect.
    setTimeout(() => {
      user.get("public").next("groups", async groups => {
        if (!groups) return

        // Number of groups is stored to know when we're done loading.
        setGroupCount(Object.keys(groups).length)
        // Need to set a listener for each group.
        for (const name of Object.keys(groups)) {
          user
            .get("public")
            .next("groups")
            .next(name)
            .on(g => {
              update(name, g)
            }, true)
        }
      })
    }, 1000)
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
      {groupList && !group && <GroupList groups={groups} setGroup={setGroup} />}
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
        <AddFeed user={user} host={host} code={code} setAddFeed={setAddFeed} />
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
        user={user}
        host={host}
        group={group}
        groups={groups}
        setGroupStats={setGroupStats}
        resetGroup={resetGroup}
        currentKeys={currentKeys}
        newKeys={newKeys}
        loadMoreItems={loadMoreItems}
        feeds={feeds}
        updateStart={updateStart}
        setUpdateStart={setUpdateStart}
      />
    </>
  )
}

export default Display
