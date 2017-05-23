const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const passport = require('passport')
const LocalStrategy = require('passport-local')
const User = require('../models/user')
/*
    SignIn ------ send email + pw ------ verify email + pw combo with Local Strategy ------ Return JWT Token
    Auth'D Request for a resource ----- verify token with JWT Strategy ------ Give them resource access
*/

// Create Local Strategy for login
const localOptions = {
  usernameField: 'email'
}

//tell localStrategy to look for the email instead of userName
const localLogin = new LocalStrategy(localOptions, function(
  email,
  password,
  done
) {
  console.log('localStrategy')
  console.log(email)
  console.log(password)

  // Verify user + password
  // Call done if correct
  // Otherwise call done with false

  User.findOne({ email: email }, function(err, user) {
    //err
    if (err) {
      return done(err)
    }

    // no err, but no user found
    if (!user) {
      return done(null, false)
    }

    //found user - compare pw sent in with our encrypted pw

    user.comparePassword(password, function(err, isMatch) {
      if (err) {
        return done(err)
      }
      if (!isMatch) {
        return done(null, false)
      }

      return done(null, user)
    })
  })
})
/*
    SignUp:
    When user signs up, before we save data, we encrypt the password for storage in DB.
    Then when we save, we give a response back to the client with a JWT based on user.id + timestamp.
    The JWT uses our secret word to decode the token at a later point in time to login.
*/
// Setup Options
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: process.env.SECRET
}

// Create JWT Strategy
const jwtLogin = new JwtStrategy(jwtOptions, function(payload, done) {
  console.log('payload')
  console.log(payload)

  // this 2nd function(cb) above gets called when someone tries to log in
  // Payload => { sub: user.id, iat: timestamp }, this is the obj we sent into get encoded for the client frontend
  // Done is a callback that we call when we have a successfull auth

  // Step 1: See if user id in the payload is in the DB
  // IF true, call done
  // Else call done without user obj

  User.findById(payload.sub, function(err, user) {
    console.log('find user on auth')
    console.log(user)

    if (err) {
      return done(err, false)
    }

    if (user) {
      // null is no error, send our found user through
      done(null, user)
    } else {
      //no error, no user
      done(null, false)
    }
  })
})

// Tell Passport to use this Strategy
passport.use(jwtLogin)
passport.use(localLogin)
