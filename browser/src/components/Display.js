import Item from "./Item"

const Display = ({items}) => {
  items.map(item => <Item key={item.key} item={item}/>)
}

export default Display
