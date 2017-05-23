const mongoose = require('mongoose')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise // duplicate to supress errror
const md5 = require('md5')
const validator = require('validator')
const mongodbErrorHandler = require('mongoose-mongodb-errors')
const passportLocalMongoose = require('passport-local-mongoose')
const bcrypt = require('bcrypt-nodejs')

const userSchema = new Schema({
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Invalid Email Address'],
    required: 'Please supply an email address'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: String
})

// Generate Field on the fly
userSchema.virtual('gravatar').get(function() {
  const hash = md5(this.email)
  return `https://gravatar.com/avatar/${hash}?s=200`
})

//passport will update our schema with the appropriate fields
// userSchema.plugin(passportLocalMongoose, { usernameField: 'email' }) //set username as email
userSchema.plugin(mongodbErrorHandler) //change ugly errors to nice looking errors we can display on front end

// On Save Hook, encrypt password
// Before saving a model, run this function
// run this right before a user is saved
userSchema.pre('save', function(next) {
  // Context is the user model about to be saved
  const user = this
  console.log('pre save')

  // generate a salt, then pass callback after salt has been created
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      return next(err)
    }

    // hash password using salt
    // when we get hash back run callback
    bcrypt.hash(user.password, salt, null, function(err, hash) {
      if (err) {
        return next(err)
      }

      // overwrite user password with the salt/encrypted password
      user.password = hash
      next()
    })
  })
})

//Helper method to check PW
userSchema.methods.comparePassword = function(candidatePassword, callback) {
  //compare with bcrypt method
  // this.password is the pw stored in the DB
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) {
      return callback(err)
    }

    callback(null, isMatch)
  })
}

module.exports = mongoose.model('User', userSchema)
