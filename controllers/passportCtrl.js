const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const passport = require('passport')
const LocalStrategy = require('passport-local')
const User = require('../models/user')
const authUtils = require('../utils/authUtils')
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
const cookieExtractor = function(req) {
  var token = null
  if (req && req.cookies) {
    token = req.cookies['jwt']
  }
  return token
}

const extractCSRFCookie = req => {
  if (!req.headers.cookie) {
    return undefined
  }
  const csrfCookie = req.headers.cookie
    .split(';')
    .find(c => c.trim().startsWith('_CSRF='))
  if (!csrfCookie) {
    return undefined
  }
  const csrf = csrfCookie.split('=')[1]
  return csrf
}

const jwtOptions = {
  jwtFromRequest: cookieExtractor,
  secretOrKey: process.env.SECRET,
  passReqToCallback: true,
  ignoreExpiration: true
}

// Create JWT Strategy
const jwtLogin = new JwtStrategy(jwtOptions, function(request, payload, done) {
  /*
  2 cookies should be attached to the payload.
  One cookie should be _CSRF
  Second cookie should be the JWT which is decoded and located in 'payload'
  **** The goal is to match the _CSRF with the csrf key in the jwt ****
  */

  const decodedUser = payload

  const csrf = extractCSRFCookie(request)
  // if No match - quit right away
  if (csrf !== payload.csrf) {
    const error = {
      message: 'Invalid User'
    }
    return done(error, false)
  }

  /*
  Check the exp key in the JWT if its:
  A: Expired - If its expired passport JWTStrategy will automatically reject,
  B: Within 15 min of expiring?
  C: Doesn't need a refresh and is good

  IF B - The second middleware called refreshTokens will look for 
  the refresh object passed into it from this middleware and take care 
  of refreshing the tokens and removing/creating new cookies for the response
  only if a user is ALSO found in the DB
  */

  // will be 'expired', 'refresh', null
  const refresh = {
    token: authUtils.checkTokenForExp(payload.exp)
  }

  console.log('refesh result?', refresh)
  // let refresh = {
  //   token: false
  // }
  // authUtils.checkTokenForExp(payload.exp, token => {
  //   switch (token) {
  //     // if Expired - quit right away
  //     case 'expired':
  //       const error = {
  //         message: 'Expired User'
  //       }
  //       return done(error, false)
  //       break
  //     case 'refresh':
  //       refresh.token = true
  //       break

  //     default:
  //     // do nothing
  //   }
  // })

  User.findById(payload.sub, function(err, user) {
    // console.log('find user on auth')
    // console.log(user)

    if (err) {
      return done(err, false)
    }

    if (user) {
      // null is no error, send our found user through
      done(null, user, { refresh, decodedUser })
    } else {
      //no error, no user
      // no user found - so token doesnt matter anyways
      done(null, false)
    }
  })
})

// Tell Passport to use this Strategy
passport.use(jwtLogin)
passport.use(localLogin)
