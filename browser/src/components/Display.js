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

const Display = ({host, user, code, mode, setMode}) => {
  const sortByLatest = (a, b) => b.latest - a.latest
  const [groups, updateGroup] = useReducer(reducer(sortByLatest), init)
  const [groupList, setGroupList] = useState(true)
  const [currentGroup, setCurrentGroup] = useState("")
  const [message, setMessage] = useState("")
  const [feedList, setFeedList] = useState(false)
  const [addFeed, setAddFeed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState(null)
  const [currentKeys, setCurrentKeys] = useState([])
  const [newKeys, setNewKeys] = useState([])
  const lastCheck = useRef(Date.now())
  const interval = useRef(0)

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
      if (!user || !key || group.count === 0) return

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

  useEffect(() => {
    // ItemList handles updates when group is set.
    if (!host || !groups || group || newKeys.length === 0) return

    const groupStats = new Map()
    groups.all.forEach(g =>
      groupStats.set(g.key, {
        count: g.count,
        latest: 0,
        text: "",
        author: "",
      }),
    )
    newKeys.forEach(async key => {
      if (!key) return

      const item = await host.get("items").get(key).then()
      if (!item) return

      const url = dec(item.url)
      groups.all.forEach(g => {
        if (!g.feeds.includes(url)) return

        let stats = groupStats.get(g.key)
        if (stats.latest === 0) {
          stats.latest = key
          stats.text = item.content
          stats.author = item.author
        }
        stats.count++
        groupStats.set(g.key, stats)
      })
    })
    // The above forEach is async so wait for it to finish.
    setTimeout(() => setGroupStats(groupStats), 1000)
  }, [host, group, groups, newKeys, setGroupStats])

  useEffect(() => {
    if (!host || !groups || groups.all.length === 0) return

    const seen = new Set()
    let keys = []
    // Don't start new key checks until existing items have been loaded.
    lastCheck.current = Date.now() + 10000
    groups.all.forEach(g => g.items.clear())
    host
      .get("items")
      .map()
      .once((item, key) => {
        if (!item || !item.url || !key || seen.has(key)) return

        seen.add(key)
        const url = dec(item.url)
        groups.all.forEach(g => {
          if (g.feeds.includes(url)) g.items.add(key)
        })
        // map subscribes to new items, so once existing items have been loaded
        // push new item keys.
        if (key > lastCheck.current) {
          keys.push(key)
        }
      })
    clearInterval(interval.current)
    interval.current = setInterval(() => {
      if (keys.length === 0) return

      lastCheck.current = Date.now()
      // Sort in ascending order for new items.
      setNewKeys(keys.sort((a, b) => a - b))
      keys = []
    }, 5000)
  }, [host, groups])

  useEffect(() => {
    setMessage("")
    if (!group) return

    let wait = 0
    if (lastCheck.current > Date.now()) {
      wait = lastCheck.current - Date.now()
      if (wait > 1000) {
        setLoading(true)
      }
    }
    setTimeout(() => {
      setLoading(false)
      if (group.items.size === 0) {
        setMessage("No items found for group. Check back later!")
        return
      }

      // Sort in descending order for existing items as older items don't
      // need to be processed until user scrolls back.
      setCurrentKeys(Array.from(group.items).sort((a, b) => b - a))
    }, wait)
    window.history.pushState(null, "")
  }, [group])

  useEffect(() => {
    if (!user) return

    updateGroup({reset: true})
    user
      .get("public")
      .get("groups")
      .map()
      .on((group, name) => {
        if (!group || !name) return

        user
          .get("public")
          .get("groups")
          .get(name)
          .get("feeds")
          .once(feeds => {
            // Convert feeds object to an array, removing data added by gun.
            // See FeedList createGroup which converts the array to an object.
            if (feeds) delete feeds._
            updateGroup({
              key: dec(name),
              feeds: feeds ? Object.keys(feeds).map(f => dec(f)) : [],
              count: group ? group.count : 0,
              latest: group ? group.latest : 0,
              text: group ? dec(group.text) : "",
              author: group ? dec(group.author) : "",
              // items is a key cache to check if a given item is in the group.
              items: new Set(),
            })
          })
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
          groups={groups}
          currentGroup={currentGroup}
          showGroupList={showGroupList}
        />
      )}
      {feedList && !addFeed && (
        <FeedList user={user} groups={groups} showGroupList={showGroupList} />
      )}
      {feedList && addFeed && (
        <AddFeed host={host} user={user} code={code} setAddFeed={setAddFeed} />
      )}
      {loading && (
        <Box sx={{display: "flex", justifyContent: "center", p: 4}}>
          <CircularProgress />
        </Box>
      )}
      {message && (
        <Box sx={{display: "flex", justifyContent: "center", p: 4}}>
          <Typography>{message}</Typography>
        </Box>
      )}
      {group && (
        <ItemList
          host={host}
          group={group}
          groups={groups}
          setGroupStats={setGroupStats}
          resetGroup={resetGroup}
          currentKeys={currentKeys}
          newKeys={newKeys}
          loading={loading}
        />
      )}
    </>
  )
}

export default Display
