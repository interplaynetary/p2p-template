import { useReducer } from "react"
import Grid from "@mui/material/Grid"
import Item from "./Item"

const init = {all:[], keys:[]}
const reducer = (current, add) => {
  if (add.reset) return init
  return {
    all: current.keys.includes(add.key) ? current.all : [add, ...current.all],
    keys: [add.key, ...current.keys],
  }
}

const Display = ({user, gun, host}) => {
  const [items, updateItem] = useReducer(reducer, init)

  // TODO: pull the user's config and apply it to the list of items.
  // that means we need display options to create channels and can then
  // add feeds to channels.
  user.get("public").get("settings").get("config").once(config => {
    if (!config) {
      return
    }

    if (config.channelFeeds && config.channelFeeds[config.currentChannel]) {
      updateItem({reset: true})
      // Default display should start by getting items by date (ie item.key) and
      // paginating the data. After that can filter by the user's selected channel
      host.get("items").map().once((data, key) => {
        if (!config.channelFeeds[config.currentChannel].includes(data.xml_url)) return

        updateItem({
          key: key,
          title: data.title,
          content: data.content,
          author: data.author,
          category: data.category,
          enclosure: data.enclosure,
          permalink: data.permalink,
          guid: data.guid,
          timestamp: data.timestamp,
          xml_url: data.xml_url,
        })
      }, {wait: 0})
    }
  }, {wait: 0})

  return (
    <Grid item xs={12}>
      {items.all.map(item => <Item key={item.key} item={item}/>)}
    </Grid>
  )
}

export default Display
