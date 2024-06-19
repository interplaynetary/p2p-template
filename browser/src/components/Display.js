import {useState} from "react"
import FeedList from "./FeedList"
import GroupList from "./GroupList"
import ItemList from "./ItemList"
import SearchAppBar from "./SearchAppBar"

const Display = ({host, user, mode, setMode}) => {
  const [groupList, setGroupList] = useState(true)
  const [feedList, setFeedList] = useState(false)
  const [group, setGroup] = useState(null)

  const createGroup = start => {
    setGroupList(!start)
    setFeedList(start)
    start && setGroup(null)
  }

  return (
    <>
    {user.is &&
     <SearchAppBar
       groupList={groupList}
       createGroup={createGroup}
       mode={mode}
       setMode={setMode}
     />}
    {groupList && !group &&
     <GroupList
       user={user}
       setGroup={setGroup}
     />}
    {feedList && !group &&
     <FeedList
       host={host}
       user={user}
       done={() => createGroup(false)}
     />}
    {group &&
     <ItemList
       host={host}
       group={group}
     />}
    </>
  )
}

export default Display
