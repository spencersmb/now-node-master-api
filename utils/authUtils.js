const jwt = require('jwt-simple')
const moment = require('moment')
const CSRF = require('csrf')
const envConfig = require('../config/env-config')

exports.checkTokenForExp = tokenExp => {
  const currentTime = moment().unix()
  const expired = tokenExp < currentTime // because time goes up
  if (expired) {
    console.log('JWT expired')
    // refresh = 'expired'
    return true
  }

  // default is nothing happens
  // cb(refresh)
  console.log('Token doesnt need refresh')
  return false
}

exports.createUserToken__JWT = (user, csrf, refreshToken) => {
  // const timestamp = moment().toDate().getTime()
  const timestamp = moment()
  const exp = moment(timestamp).add(1, 'm').unix()

  // first arg is the info we want encrypted
  // 2nd arg is the secret we want to encode with
  return jwt.encode(
    {
      // subject - who is this token about -jwt standard
      sub: user._id,
      email: user.email,
      name: user.name,
      csrf: csrf,
      rfs: refreshToken,
      exp: exp,
      iat: timestamp // issue at time
    },
    process.env.SECRET
  )
}

exports.createUserToken__CSRF = () => {
  const _csrf = new CSRF()
  return _csrf.create(process.env.SECRET)
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

exports.clearCookies = res => {
  res.clearCookie('_CSRF')
  res.clearCookie('jwt')
}

exports.addTokenCookiesToResponse = (jwt, csrf, res) => {
  res.cookie('jwt', jwt, {
    httpOnly: true,
    maxAge: 7 * 24 * 3600000
  })

  res.cookie('_CSRF', csrf, {
    httpOnly: true,
    maxAge: 7 * 24 * 3600000
  })
}

exports.compareCSRFTokens = (cookieCSRF, jwtCSRF) => {
  if (cookieCSRF !== jwtCSRF) {
    return false
  }

  return true
}
