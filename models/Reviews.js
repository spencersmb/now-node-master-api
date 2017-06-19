const mongoose = require('mongoose')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise // duplicate to supress errror
const mongodbErrorHandler = require('mongoose-mongodb-errors')

const reviewSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author!'
  },
  store: {
    type: mongoose.Schema.ObjectId,
    ref: 'Store',
    required: 'You must supply a store'
  },
  text: {
    type: String,
    required: 'Your review must have text'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  }
})

//passport will update our schema with the appropriate fields
// userSchema.plugin(passportLocalMongoose, { usernameField: 'email' }) //set username as email
reviewSchema.plugin(mongodbErrorHandler) //change ugly errors to nice looking errors we can display on front end

// Hook to populate the author field
function autoPopulate(next) {
  const removeFields = ['-password', '-userCreatedAt', '-valid', '-__v']
  this.populate('author', removeFields)
  next()
}

// add the hook to these queries
reviewSchema.pre('find', autoPopulate)
reviewSchema.pre('findOne', autoPopulate)

module.exports = mongoose.model('Review', reviewSchema)
