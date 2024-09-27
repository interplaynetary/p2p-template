import {useCallback, useEffect, useReducer, useRef, useState} from "react"
import {enc, dec} from "../utils/text.js"
import {init, reducer} from "../utils/reducer.js"
import FeedList from "./FeedList"
import GroupList from "./GroupList"
import ItemList from "./ItemList"
import SearchAppBar from "./SearchAppBar"

const Display = ({host, user, mode, setMode}) => {
  const sortByLatest = (a, b) => b.latest - a.latest
  const [groups, updateGroup] = useReducer(reducer(sortByLatest), init)
  const [groupList, setGroupList] = useState(true)
  const [feedList, setFeedList] = useState(false)
  const [group, setGroup] = useState(null)
  const [currentKeys, setCurrentKeys] = useState([])
  const [newKeys, setNewKeys] = useState([])
  const [updateKeys, setUpdateKeys] = useState([])
  const lastCheck = useRef(Date.now())

  const createGroup = () => {
    setGroupList(false)
    setFeedList(true)
    setGroup(null)
  }

  const createGroupDone = () => {
    setGroupList(true)
    setFeedList(false)
  }

  const resetGroup = useCallback(
    key => {
      if (!user || group.count === 0) return

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
        if (stats.latest === 0) return

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
    if (!host || group || newKeys.length === 0) return

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
    const keys = []
    updateKeys.forEach(async key => {
      if (key <= lastCheck.current) return

      keys.push(key)
    })
    lastCheck.current = Date.now()
    setCurrentKeys(current => [...keys, ...current])
    setNewKeys(keys)
  }, [updateKeys])

  useEffect(() => {
    if (!host) return

    host.get("items").once(items => {
      if (!items) return

      delete items._
      setCurrentKeys(Object.keys(items).sort((a, b) => b - a))
    })

    host.get("items").on(items => {
      if (!items) return

      delete items._
      setUpdateKeys(Object.keys(items).sort((a, b) => b - a))
    })
  }, [host])

  useEffect(() => {
    if (!user) return

    updateGroup({reset: true})
    user
      .get("public")
      .get("groups")
      .map()
      .on((group, name) => {
        if (!group) return

        user
          .get("public")
          .get("groups")
          .get(name)
          .get("feeds")
          .once(feeds => {
            if (!feeds) return

            // Convert feeds object to an array, removing data added by gun.
            // See FeedList createGroup which converts the array to an object.
            delete feeds._
            updateGroup({
              key: dec(name),
              feeds: Object.keys(feeds).map(f => dec(f)),
              count: group.count,
              latest: group.latest,
              text: dec(group.text),
              author: dec(group.author),
            })
          })
      })
  }, [user])

  return (
    <>
      {user.is && (
        <SearchAppBar
          groupList={groupList}
          createGroup={createGroup}
          mode={mode}
          setMode={setMode}
          title={group ? group.key : ""}
        />
      )}
      {groupList && !group && (
        <GroupList user={user} groups={groups} setGroup={setGroup} />
      )}
      {feedList && !group && (
        <FeedList host={host} user={user} done={createGroupDone} />
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
        />
      )}
    </>
  )
}

export default Display
