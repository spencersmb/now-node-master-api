const mongoose = require('mongoose')
const User = mongoose.model('User')
const RefreshToken = mongoose.model('RefreshToken')
const Session = mongoose.model('Session')
const promisify = require('es6-promisify')
const authUtils = require('../utils/authUtils')
const randToken = require('rand-token')
const jwToken = require('jsonwebtoken')
const crypto = require('crypto')
const moment = require('moment')
const env = require('../config/env-config')
const mail = require('../handlers/mail')
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

  authUtils.addTokenCookiesToResponse(jwt, csrf, res)

  // find existing session
  // if none found create new one
  Session.findOne({ email: email }, function(err, existingSession) {
    if (err) {
      return res.status(500).send(err)
    }

    if (existingSession) {
      const rfshToken = new RefreshToken({
        token: refreshToken
      })

      existingSession.refreshTokens.push(rfshToken)
      existingSession.save(function(err) {
        if (err) {
          return res.status(500).send(err)
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
        return res.status(500).send(err)
      }

      res.send({ token: jwt })
    })

    return
  })
}

// ADD CHECKS FOR NEW PASSWORD OR EMAIL CHANGES using expiredTimestamp
// ALSO IF USER IS VERIFIED(not valid)

//if they have request - log user out with 401 response
exports.refreshTokens = async (req, res, next) => {
  console.log('Start refreshToken function')
  // no refresh needed move on to next middleware
  // this is sent from the Require Auth module
  if (!req.authInfo.refresh.token) {
    next()
    return
  }

  const decodedUser = req.authInfo.decodedUser
  const email = decodedUser.email
  const rfsToken = decodedUser.rfs
  const csrfToken = decodedUser.csrf
  const reqCSRF = req.cookies._CSRF

  // make sure user is valid
  User.findOne({ email: email }, async function(err, existingUser) {
    if (err) {
      return res.status(500).send(err)
    }

    if (!existingUser) {
      console.log('!existingUser')
      authUtils.clearCookies(res)
      return res.status(401).send('Unauthorized')
    }

    // insert check that CSRF matches
    if (!authUtils.compareCSRFTokens(reqCSRF, csrfToken)) {
      console.log('!compareCSRF')
      return res.status(401).send('Unauthorized')
    }

    //insert check for password reset flag

    // Create new tokens
    const refreshToken = randToken.uid(256)
    const csrf = authUtils.createUserToken__CSRF()
    const jwt = authUtils.createUserToken__JWT(existingUser, csrf, refreshToken)

    // update session in the DB with new tokens
    const result = await Session.findOneAndUpdate(
      { email: email, 'refreshTokens.token': rfsToken },
      {
        $set: { 'refreshTokens.$': new RefreshToken({ token: refreshToken }) },
        new: true,
        returnNewDocument: true
      }
    )

    // If nothing was updated then the update failed
    if (!result) {
      console.log('no result')

      authUtils.clearCookies(res)
      return res.status(401).send('Unauthorized')
    }

    authUtils.addTokenCookiesToResponse(jwt, csrf, res)

    // attach new jwt to send with response in the next middlewares
    res.locals.token = jwt

    next()
  })
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
    console.log(errors)

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

  //step 2: see if a user with a given email exists
  User.findOne({ email: email }, async function(err, existingUser) {
    console.log('Find user')
    // check for DB error first
    if (err) {
      return next(err)
    }

    // If a user with email does exist, return an error
    if (existingUser) {
      console.log('Existing error')

      //return http code - unprocessable data
      return res.status(422).send({ error: 'Email is in use' })
    }

    // create new user in memory
    // If a user with email does not exist, create and save user record
    const timestamp = moment()
    const exp = moment(timestamp).add(60, 'm').unix()
    const user = new User({
      email: email,
      password: password,
      name: name,
      validateUserToken: crypto.randomBytes(20).toString('hex'),
      validateUserExp: exp
    })

    const registerURL = `${env.variables.RAW_URL}/account/confirm/${user.validateUserToken}`

    // Save record to the DB
    // callback for when we get notified if user was saved or not
    try {
      await user.save()

      // send email with new token
      await mail.send({
        user,
        subject: 'Confirm Registration',
        registerURL,
        filename: 'confirm-registration'
      })
    } catch (err) {
      console.log('weird error?', err)
      return res.status(500).send(err)
    }

    res.send({
      data: {
        message: 'Please check your email to confirm user'
      }
    })
  })
}

exports.signout = async function(req, res, next) {
  //User has already been authed - just need to give them a token
  console.log('sign out')
  const jwt = req.cookies.jwt
  let decoded

  try {
    decoded = await jwToken.verify(req.cookies.jwt, process.env.SECRET, {
      ignoreExpiration: true //handled by OAuth2 server implementation
    })

    const email = decoded.email
    const rfsToken = decoded.rfs
    const query = { email: email }
    const update = { $pull: { refreshTokens: { token: rfsToken } } }
    const options = { new: false }

    Session.findOneAndUpdate(query, update, options, function(err, item) {
      if (err) {
      }
      if (item.refreshTokens.length <= 1) {
        item.remove()
      }
    })
  } catch (err) {
    console.log('JWT error')
    return res.status(500).send(err)
  }

  authUtils.clearCookies(res)
  return res.send({ status: 'signedOUt' })
}

exports.updateAccount = async function(req, res, next) {
  /*
  * Get new user and update USER in DB
  * If emails don't match, meaning it was changed
  * Then update the Session Object that matches the user and refreshToken, with updated info 
  */
  const decodedUser = req.authInfo.decodedUser
  const email = decodedUser.email
  const rfsToken = decodedUser.rfs
  const csrfToken = decodedUser.csrf
  const newUser = req.body

  let user
  try {
    user = await User.findOneAndUpdate(
      { _id: decodedUser.sub },
      { $set: newUser },
      { new: true, runValidators: true, context: 'query' }
    )
  } catch (e) {
    res.status(500).send({ error: e })
  }

  const refreshToken = randToken.uid(256)
  const csrf = authUtils.createUserToken__CSRF()
  const jwt = authUtils.createUserToken__JWT(user, csrf, refreshToken)

  // then find oldUser in SESSIONS and delete full doc? Then add new SESSION
  // Replace email + the refreshToken.token
  if (user.email !== email) {
    console.log('new email too')

    const session = await Session.findOneAndUpdate(
      { email: decodedUser.email, 'refreshTokens.token': rfsToken },
      {
        $set: {
          email: user.email,
          'refreshTokens.$': new RefreshToken({ token: refreshToken })
        }
      },
      { new: true, context: 'query' }
    )
  }

  // update new cookies
  authUtils.addTokenCookiesToResponse(jwt, csrf, res)

  // res.status 200
  res.send({ data: user })
}

exports.forgotUser = async function(req, res, next) {
  // see if user exists
  const user = await User.findOne({ email: req.body.email })
  if (!user) {
    return res.status(422).send({ error: 'No account with that email exists' })
  }
  // set reset tokens and expirey on account
  const timestamp = moment()
  const exp = moment(timestamp).add(60, 'm').unix()
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex')
  user.resetPasswordExp = exp
  await user.save()

  const resetURL = `${env.variables.RAW_URL}/account/reset/${user.resetPasswordToken}`

  // send email with new token
  await mail.send({
    user,
    subject: 'Password Reset',
    resetURL,
    filename: 'password-reset'
  })

  res.send({
    data: {
      message: `Please check your email for the reset link.`
    }
  })

  // redirect with login page
}

exports.resetCheck = async function(req, res, next) {
  // find user by resetToken
  const now = moment().unix()
  const resetToken = req.body.resetToken
  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExp: { $gt: now }
  })

  if (!user) {
    return res
      .status(422)
      .send({ error: 'Password reset is invalid or has expired' })
  }

  return res.send({ message: 'valid user' })
}

exports.confirm = async function(req, res, next) {
  console.log('body')
  console.log(req.body)

  // find user by resetToken
  // find user by resetToken
  const now = moment().unix()
  const validateUserToken = req.body.token
  const user = await User.findOne({
    validateUserToken: validateUserToken,
    validateUserExp: { $gt: now }
  })

  if (!user) {
    return res.status(422).send({ error: 'Request is invalid or has expired' })
  }

  user.valid = true
  user.validateUserToken = undefined
  user.validateUserExp = undefined

  //PROBLY COULD CREAT JWT TOKEN CLASS to user
  const refreshToken = randToken.uid(256)
  const csrf = authUtils.createUserToken__CSRF()
  const jwt = authUtils.createUserToken__JWT(user, csrf, refreshToken)

  const session = new Session({
    email: user.email,
    refreshTokens: [
      {
        token: refreshToken
      }
    ]
  })

  // Save record to the DB
  // callback for when we get notified if user was saved or not
  try {
    await user.save()
    await session.save()

    // send Confirmation EMAIL?
    // await mail.send({
    //   user,
    //   subject: 'Confirm Registration',
    //   registerURL,
    //   filename: 'confirm-registration'
    // })
  } catch (err) {
    return res.status(500).send(err)
  }

  authUtils.addTokenCookiesToResponse(jwt, csrf, res)

  res.send({ token: jwt }) // probly dont need to send jwt here
}

exports.updatePassword = async function(req, res, next) {
  console.log('body')
  console.log(req.body)

  // find user by resetToken
  // find user by resetToken
  const now = moment().unix()
  const resetToken = req.body.token
  const updatedPassword = req.body.password
  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExp: { $gt: now }
  })

  if (!user) {
    return res
      .status(422)
      .send({ error: 'Password reset is invalid or has expired' })
  }

  user.password = updatedPassword
  user.resetPasswordExp = undefined
  user.resetPasswordToken = undefined
  user.save()

  const update = authUtils.checkForTokenRefresh(
    { message: 'password updated' },
    null
  )

  return res.send(update)
}
