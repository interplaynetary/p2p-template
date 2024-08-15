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

const Display = ({host, user, mode, setMode}) => {
  const [groups, updateGroup] = useReducer(reducer, init)
  const [groupList, setGroupList] = useState(true)
  const [feedList, setFeedList] = useState(false)
  const [group, setGroup] = useState(null)

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
    if (!user) return

    updateGroup({reset: true})
    user.get("public").get("groups").map().on((group, key) => {
      if (!group) return

      user.get("public").get("groups").get(key).get("feeds").once(feeds => {
        if (!feeds) return

        // Convert feeds object to an array, removing data added by gun.
        // See FeedList createGroup which converts the array to an object.
        delete feeds._
        updateGroup({
          key,
          name: group.name,
          feeds: Object.keys(feeds),
          start: group.start,
          updated: group.updated,
        })
      }, {wait: 0})
    }, {wait: 0})
  }, [user])

  return (
    <>
    {user.is &&
     <SearchAppBar
       groupList={groupList}
       createGroup={createGroup}
       mode={mode}
       setMode={setMode}
       title={group ? group.name : ""}
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
       user={user}
       group={group}
     />}
    </>
  )
}

export default Display
