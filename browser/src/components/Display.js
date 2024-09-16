import {useEffect, useReducer, useState} from "react"
import FeedList from "./FeedList"
import GroupList from "./GroupList"
import ItemList from "./ItemList"
import SearchAppBar from "./SearchAppBar"

const init = {all:[], keys:[]}
const reducer = (current, add) => {
  if (add.reset) return init
  return {
    all: current.keys.includes(add.key) ? current.all : [add, ...current.all],
    keys: [add.key, ...current.keys],
  }
}

const dec = t => t ? new TextDecoder().decode(Uint8Array.from(atob(t), e => e.codePointAt(0))) : ""

const Display = ({host, user, mode, setMode}) => {
  const [groups, updateGroup] = useReducer(reducer, init)
  const [groupList, setGroupList] = useState(true)
  const [feedList, setFeedList] = useState(false)
  const [group, setGroup] = useState(null)
  const [keys, setKeys] = useState([])

  const createGroup = () => {
    setGroupList(false)
    setFeedList(true)
    setGroup(null)
  }

  const createGroupDone = () => {
    setGroupList(true)
    setFeedList(false)
  }

  useEffect(() => {
    if (!host) return

    host.get("items").once(items => {
      if (!items) return

      delete items._
      // Existing keys are set for all groups to use.
      setKeys(Object.keys(items).sort((a, b) => b - a))
    })
  }, [host])

  useEffect(() => {
    if (!user) return

    updateGroup({reset: true})
    user.get("public").get("groups").map().on((group, name) => {
      if (!group) return

      user.get("public").get("groups").get(name).get("feeds").once(feeds => {
        if (!feeds) return

        // Convert feeds object to an array, removing data added by gun.
        // See FeedList createGroup which converts the array to an object.
        delete feeds._
        updateGroup({
          key: dec(name),
          feeds: Object.keys(feeds).map(f => dec(f)),
          updated: group.updated,
        })
      })
    })
  }, [user])

  return (
    <>
    {user.is &&
     <SearchAppBar
       groupList={groupList}
       createGroup={createGroup}
       mode={mode}
       setMode={setMode}
       title={group ? group.key : ""}
     />}
    {groupList && !group &&
     <GroupList
       user={user}
       groups={groups}
       setGroup={setGroup}
     />}
    {feedList && !group &&
     <FeedList
       host={host}
       user={user}
       done={createGroupDone}
     />}
    {group &&
     <ItemList
       host={host}
       group={group}
       keys={keys}
     />}
    </>
  )
}

export default Display
