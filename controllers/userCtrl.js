const mongoose = require('mongoose')
const User = mongoose.model('User')
const RefreshToken = mongoose.model('RefreshToken')
const Session = mongoose.model('Session')
const promisify = require('es6-promisify')
const authUtils = require('../utils/authUtils')
const randToken = require('rand-token')

exports.refreshTokens = async (req, res, next) => {
  console.log('Start refreshToken function')
  // console.log(req.authInfo.refresh.token)
  console.log(req.authInfo)
  console.log(req.body)
  const email = req.body.email
  const rfsToken = req.body.rfs

  // make sure user is valid
  User.findOne({ email: email }, async function(err, existingUser) {
    if (err) {
      return next(err)
    }

    if (!existingUser) {
      authUtils.clearCookies(res)
      res.status(401).send('Unauthorized')
      return
    }

    const refreshToken = randToken.uid(256)
    const csrf = authUtils.createUserToken__CSRF()
    const jwt = authUtils.createUserToken__JWT(existingUser, csrf, refreshToken)

    const result = await Session.findOneAndUpdate(
      { email: email, 'refreshTokens.token': rfsToken },
      {
        $set: { 'refreshTokens.$': new RefreshToken({ token: refreshToken }) },
        new: true,
        returnNewDocument: true
      }
    )

    if (!result) {
      authUtils.clearCookies(res)
      res.status(401).send('Unauthorized')
      return
    }
    console.log('new save')

    authUtils.addTokenCookiesToResponse(jwt, csrf, res)

    res.send({ token: jwt })

    //user found look up session
    // Session.findOne(
    //   { email: email, 'refreshTokens.token': rfsToken },
    //   async function(err, existingSession) {
    //     if (err) {
    //       console.log('error in session', err)

    //       return next(err)
    //     }

    //     if (!existingSession) {
    //       res.status(401).send('Unauthorized')
    //       return
    //     }

    //     const refreshToken = randToken.uid(256)
    //     const csrf = authUtils.createUserToken__CSRF()
    //     const jwt = authUtils.createUserToken__JWT(
    //       existingUser,
    //       csrf,
    //       refreshToken
    //     )

    //     const matchedSession = existingSession.refreshTokens.map(session => {
    //       if (session.token === rfsToken) {
    //         let newToken = new RefreshToken({ token: refreshToken })
    //         return (session = newToken)
    //       } else {
    //         return session
    //       }
    //     })

    //     existingSession.refreshTokens = matchedSession

    //     const cb = await existingSession.save()

    //     console.log('saved')

    //     res.cookie('jwt', jwt, {
    //       httpOnly: true,
    //       maxAge: 7 * 24 * 3600000
    //     })
    //     res.cookie('_CSRF', csrf, {
    //       httpOnly: true,
    //       maxAge: 7 * 24 * 3600000
    //     })

    //     res.send({ token: jwt })
    //   }
    // )
  })

  // // no refresh needed move on to next middleware
  // if (!req.authInfo.refresh.token) {
  //   next()
  //   return
  // }

  // // Create new tokens
  // const csrf = authUtils.createUserToken__CSRF()
  // const token = authUtils.createUserToken__JWT(req.user, csrf)

  // // Create new cookies and attach to res
  // res.cookie('jwt', token, {
  //   httpOnly: true
  // })
  // res.cookie('_CSRF', csrf, {
  //   httpOnly: true
  // })

  // res.locals.token = token

  // // move to the next middleware
  // next()
}

exports.updateUser = async (req, res, next) => {
  const update = authUtils.checkForTokenRefresh(req.body, res.locals.token)
  res.send(update)
}

exports.validateRegister = (req, res, next) => {
  //
  //sanitize name
  //
  req.sanitizeBody('name')
  req.checkBody('name', 'You must supply a name').notEmpty()
  req.checkBody('email', 'That email is not valid').isEmail()
  req.sanitizeBody('email').normalizeEmail({
    gmail_remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false
  })

  req.checkBody('password', 'Password cannot be blank').notEmpty()

  req
    .checkBody('passwordConfirm', 'Confirm Password cannot be blank')
    .notEmpty()

  req
    .checkBody('passwordConfirm', 'Oops! Your passwords do not match')
    .equals(req.body.password)

  const errors = req.validationErrors()

  if (errors) {
    console.log('validation errors')
    return res.status(422).send({ errors })
  }
  next() // There were no validation errors
}

exports.registerUser = async (req, res, next) => {
  console.log('register user')
  console.log(req.body)

  const email = req.body.email
  const password = req.body.password
  const name = req.body.name

  if (!email || !password) {
    return res
      .status(422)
      .send({ error: 'You must supply an email and a password' })
  }

  // try {
  //   //Make method user promises
  //   const register = promisify(User.register, User)
  //   const userDB = await register(user, req.body.password)
  //   // use the register method given to use by setting up the passport pluing in user.js line 26

  //   res.json({ token: tokenForUser(user) })
  // } catch (e) {
  //   console.log('error on node registration')
  //   res.status(400).send({ message: e.message })
  // }
  // // next()

  //step 2: see if a user with a given email exists
  User.findOne({ email: email }, function(err, existingUser) {
    console.log('Find user')
    // check for DB error first
    if (err) {
      return next(err)
    }

    // If a user with email does exist, return an error
    if (existingUser) {
      console.log('Existing error')

      //return http code - unprocessable data
      res.status(422).send({ error: 'Email is in use' })
    }

    // create new user in memory
    // If a user with email does not exist, create and save user record
    const user = new User({
      email: email,
      password: password,
      name: name
    })

    // Save record to the DB
    // callback for when we get notified if user was saved or not
    console.log(' being save user')

    user.save(function(err) {
      if (err) {
        return next(err)
      }

      const csrf = authUtils.createUserToken__CSRF()
      const token = authUtils.createUserToken__JWT(user, csrf)

      res.cookie('jwt', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 3600000
      })
      res.cookie('_CSRF', csrf, {
        httpOnly: true,
        maxAge: 7 * 24 * 3600000
      })

      // Respond to a request indicating the user was created
      res.send({ token: token })
    })
  })
}

// On sign up:
// encode user in JWT
// create JWT COOKIE in res
// create CSRF COOKIE in res
// Find if user has a session
// If true add a new refreshToken to session
// If false - create and add session in DB with refreshtoken
// Send JWT response back to server
exports.signin = function(req, res, next) {
  //User has already been authed - just need to give them a token
  console.log('signin!')
  const email = req.user.email

  const refreshToken = randToken.uid(256)
  const csrf = authUtils.createUserToken__CSRF()
  const jwt = authUtils.createUserToken__JWT(req.user, csrf, refreshToken)

  res.cookie('jwt', jwt, {
    httpOnly: true,
    maxAge: 7 * 24 * 3600000
  })
  res.cookie('_CSRF', csrf, {
    httpOnly: true,
    maxAge: 7 * 24 * 3600000
  })

  // find existing session
  // if none found create new one
  Session.findOne({ email: email }, function(err, existingSession) {
    if (err) {
      return next(err)
    }

    if (existingSession) {
      const rfshToken = new RefreshToken({
        token: refreshToken
      })

      existingSession.refreshTokens.push(rfshToken)
      existingSession.save(function(err) {
        if (err) {
          return next(err)
        }

        res.send({ token: jwt })
      })

      return
    }

    const session = new Session({
      email: email,
      refreshTokens: [
        {
          token: refreshToken
        }
      ]
    })

    // Save new session to DB
    session.save(function(err) {
      if (err) {
        return next(err)
      }

      res.send({ token: jwt })
    })
  })
}

exports.signout = function(req, res, next) {
  //User has already been authed - just need to give them a token
  console.log('sign out')
  authUtils.clearCookies(res)
  res.send({ status: 'signedOUt' })
}
