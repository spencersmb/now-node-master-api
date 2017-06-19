const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const slug = require('slugs') //wordpress permalink?

const storeSchema = new mongoose.Schema(
  {
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
    photo: String,
    author: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: 'You must supply an author'
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Define stores index
storeSchema.index({ name: 'text', description: 'text' })

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

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Lookup Stores on our model and populate their reviews tag(like a virtual but different) - we do this just like the virtual method
    // but cant use virtual here so we write it differently. So we look up all reviews first
    // from is ref - so our ref is Review but mongo lowercases it and adds and 's
    // as: name of the field
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews'
      }
    },
    // Filter for only items that have 2 or more reviews
    // checks the 2nd INDEX item of the reviews array to make sure there are atleast 2 reviews
    { $match: { 'reviews.1': { $exists: true } } },
    // Add the average reviews field
    // project means add a field essentially
    // $ dollar sign on $reviews means its coming from the data being piped in
    // If we are on mongoDb 3.4^ we can use $addfield, else we use $project
    {
      $project: {
        photo: '$$ROOT.photo',
        name: '$$ROOT.name',
        reviews: '$$ROOT.reviews',
        slug: '$$ROOT.slug',
        averageRating: { $avg: '$reviews.rating' }
      }
    },
    // Sort it by our new field, heighst reviews first
    { $sort: { averageRating: -1 } },
    // limit to at most 10
    { $limit: 10 }
  ])
}

// Hook to populate the author field
function autoPopulate(next) {
  this.populate('reviews')
  next()
}

storeSchema.pre('find', autoPopulate)
storeSchema.pre('findOne', autoPopulate)

// Find reviews where the stores _id === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review', // model to link
  localField: '_id', // match which field on the store
  foreignField: 'store' // the field on the Review model we want to point to
})

module.exports = mongoose.model('Store', storeSchema)
