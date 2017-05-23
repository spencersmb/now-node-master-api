exports.convertTagsToArray = store => {
  const tags = Object.keys(store.tags)
  console.log(tags)

  //Convert tags to array
  return Object.assign({}, store, { tags: tags })
}
