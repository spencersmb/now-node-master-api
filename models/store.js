const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const slug = require('slugs') //wordpress permalink?

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  photo: String
})

//before its save - we run a function to build the SLUG
storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next()
    return
  }
  this.slug = slug(this.name)
  // Find slug if there are duplicates - wes, wes-1, wes-2
  // make regex to search
  // i = case insensitve
  // ^(${this.slug}) = match slug that starts with this.slug
  // ((-[0-9*$])?) = that might end in -2, -1, ? = optional -
  // * says could be 1 or 100, $ means ends with that
  const regEx = new RegExp(`^(${this.slug}((-[0-9*$])?)$)`, 'i')
  const storesWithSlug = await this.constructor.find({
    slug: regEx
  })

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`
  }

  next()
})

// Create our own function on the schema
// important to use a reg function call because we need to use "this" that is bound to the MODEL

storeSchema.statics.getTagsList = function() {
  // aggregate works just like find()
  return this.aggregate([
    //first unwind to get all the stores for that tag
    { $unwind: '$tags' }, // put $ infront of tags to indicate this is the field to unwind
    // Next group each item by tag, and we put our own count key that says add each on into our new key
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
}

module.exports = mongoose.model('Store', storeSchema)
