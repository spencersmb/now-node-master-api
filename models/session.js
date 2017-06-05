const mongoose = require('mongoose')
const Schema = mongoose.Schema
const RefreshToken = mongoose.model('RefreshToken')
mongoose.Promise = global.Promise // duplicate to supress errror
const mongodbErrorHandler = require('mongoose-mongodb-errors')

const sessionSchema = new Schema({
  email: {
    type: String,
    required: 'Please supply an Id'
  },
  refreshTokens: {
    type: [RefreshToken.schema],
    required: 'Please supply a refresh token'
  }
})

//passport will update our schema with the appropriate fields
// userSchema.plugin(passportLocalMongoose, { usernameField: 'email' }) //set username as email
sessionSchema.plugin(mongodbErrorHandler) //change ugly errors to nice looking errors we can display on front end

module.exports = mongoose.model('Session', sessionSchema)
