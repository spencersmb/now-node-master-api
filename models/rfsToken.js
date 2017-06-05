const mongoose = require('mongoose')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise // duplicate to supress errror
const mongodbErrorHandler = require('mongoose-mongodb-errors')

const refreshTokenSchema = new mongoose.Schema({
  token: String,
  created: { type: Date, default: Date.now }
})

refreshTokenSchema.plugin(mongodbErrorHandler) //change ugly errors to nice looking errors we can display on front end

module.exports = mongoose.model('RefreshToken', refreshTokenSchema)
