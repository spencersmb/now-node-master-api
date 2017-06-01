const mongoose = require('mongoose')
const User = mongoose.model('User')
const promisify = require('es6-promisify')
const authUtils = require('../utils/authUtils')

exports.refreshTokens = async (req, res, next) => {
  console.log('Start refreshToken function')
  console.log(req.authInfo.refresh.token)

  // no refresh needed move on to next middleware
  if (!req.authInfo.refresh.token) {
    next()
    return
  }

  // Create new tokens
  const csrf = authUtils.createUserToken__CSRF()
  const token = authUtils.createUserToken__JWT(req.user, csrf)

  // Create new cookies and attach to res
  res.cookie('jwt', token, {
    httpOnly: true
  })
  res.cookie('_CSRF', csrf, {
    httpOnly: true
  })

  res.locals.token = token

  // move to the next middleware
  next()
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
      console.log('USER ERROR')

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
        httpOnly: true
      })
      res.cookie('_CSRF', csrf, {
        httpOnly: true
      })

      // Respond to a request indicating the user was created
      res.send({ token: token })
    })
  })
}

// On sign up - encode user with JWT and give the JWT back on response
exports.signin = function(req, res, next) {
  //User has already been authed - just need to give them a token
  console.log('signin!')

  const csrf = authUtils.createUserToken__CSRF()
  const token = authUtils.createUserToken__JWT(req.user, csrf)

  res.cookie('jwt', token, {
    httpOnly: true
  })
  res.cookie('_CSRF', csrf, {
    httpOnly: true
  })

  res.send({ token: token })
}

exports.signout = function(req, res, next) {
  //User has already been authed - just need to give them a token
  res.clearCookie('_CSRF')
  res.clearCookie('jwt')
  console.log('sign out')
  res.send({ status: 'signedOUt' })
}
