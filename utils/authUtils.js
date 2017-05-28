const jwt = require('jwt-simple')
const moment = require('moment')
const Tokens = require('csrf')

exports.checkTokenForExp = tokenExp => {
  // let refresh = null

  const currentTime = moment().unix()
  const refreshWindow = 15 // min
  const expired = tokenExp < currentTime // because time goes up
  const duration = tokenExp - currentTime
  const timeLeft = moment.duration(duration * 1000, 'milliseconds')
  const minLeft = moment.duration(timeLeft).minutes()
  const withInWindowOfExpiring = minLeft <= refreshWindow && minLeft > 0

  // if (expired) {
  //   console.log('JWT expired')

  //   // refresh = 'expired'
  //   return 'expired'
  // }

  if (withInWindowOfExpiring) {
    console.log('Token needs refresh')

    // refresh = 'refresh'
    return true
  }

  // default is nothing happens
  // cb(refresh)
  console.log('Token doesnt need refresh')
  return false
}

exports.createUserToken__JWT = (user, csrf) => {
  // const timestamp = moment().toDate().getTime()
  const timestamp = moment()
  const exp = moment(timestamp).add(17, 'm').unix()

  // first arg is the info we want encrypted
  // 2nd arg is the secret we want to encode with
  return jwt.encode(
    {
      // subject - who is this token about -jwt standard
      sub: user._id,
      email: user.email,
      name: user.name,
      csrf: csrf,
      exp: exp,
      iat: timestamp // issue at time
    },
    process.env.SECRET
  )
}

exports.createUserToken__CSRF = () => {
  const tokens = new Tokens()
  return tokens.create(process.env.SECRET)
}

exports.checkForTokenRefresh = (data = {}, token) => {
  if (!token) {
    return {
      data
    }
  }
  return {
    data,
    token
  }
}
