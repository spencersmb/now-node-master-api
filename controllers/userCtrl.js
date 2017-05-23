const mongoose = require('mongoose')
const User = mongoose.model('User')
const promisify = require('es6-promisify')
const jwt = require('jwt-simple')
const moment = require('moment')
const Tokens = require('csrf')

function tokenForUser(user, req) {
  // const timestamp = moment().toDate().getTime()
  const timestamp = moment()
  const exp = moment(timestamp).add(30, 'm')
  const tokens = new Tokens()

  // first arg is the info we want encrypted
  // 2nd arg is the secret we want to encode with
  return jwt.encode(
    {
      // subject - who is this token about -jwt standard
      sub: user._id,
      email: user.email,
      name: user.name,
      gravatar: user.gravatar,
      csrf: tokens.create(process.env.SECRET),
      iat: timestamp // issue at time
    },
    process.env.SECRET
  )
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

      // Respond to a request indicating the user was created
      res.json({ token: tokenForUser(user) })
    })
  })
}

// On sign up - encode user with JWT and give the JWT back on response
exports.signin = function(req, res, next) {
  //User has already been authed - just need to give them a token
  console.log('signin!')

  // we have access to the user with token because of the done() method supplied by passport in our strategies
  // res.send({
  //   token: tokenForUser(req.user)
  // })
  // res.setHeader('Set-Cookie', ['foo=bar'])
  // res.cookie('remember', '1', { path: '/' })
  // res.cookie('jwtServer', tokenForUser(req.user), {
  //   expire: new Date() + 9999
  // })
  // res.send({ token: 'cookie set' })
  const token = tokenForUser(req.user, req)
  // res.cookie('jwtServer', token, {
  //   expire: new Date() + 9999,
  //   httpOnly: true
  // })
  // res.writeHead(200, { 'Content-Type': 'text/plain' })
  // res.send({ token: tokenForUser(req.user) })

  var exdate = new Date()
  exdate.setDate(exdate.getDate() + 10)
  // res.setHeader('Access-Control-Allow-Origin', true)
  // res.setHeader('Set-Cookie', ['type=ninja', 'language=javascript'])
  res.cookie('jwt', token, {
    httpOnly: true
  })
  // res.cookie('remember', '1', { path: '/', expires: exdate, httpOnly: true })
  // res.writeHead(200, {
  //   'Content-Type': 'text/plain',
  //   'Set-Cookie': ['type=ninja', 'language=javascript']
  // })
  // res.end('ok')
  res.send({ token: token })
}
