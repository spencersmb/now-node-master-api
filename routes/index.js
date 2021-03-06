const express = require('express')
const router = express.Router()
const storeCtrl = require('../controllers/storeCtrl.js')
const reviewCtrl = require('../controllers/reviewCtrl')
const userCtrl = require('../controllers/userCtrl.js')
const passportServices = require('../controllers/passportCtrl')
const passport = require('passport')

const requireAuth = passport.authenticate('jwt', { session: false })
const requireSignIn = passport.authenticate('local', { session: false })

router.get('/search', storeCtrl.searchStore)

router.post('/account/confirm', userCtrl.confirm)
router.post('/account/resetCheck', userCtrl.resetCheck)
router.post('/account/reset', userCtrl.updatePassword)
router.get(
  '/account/favs',
  requireAuth,
  userCtrl.refreshTokens,
  userCtrl.userMetaData
)

router.post(
  '/account',
  requireAuth,
  userCtrl.refreshTokens,
  userCtrl.updateAccount
)
router.post('/account/forgot', userCtrl.forgotUser)
router.get('/refresh', requireAuth, userCtrl.refreshTokens, userCtrl.updateUser)

router.post(
  '/add',
  requireAuth,
  userCtrl.refreshTokens,
  storeCtrl.upload,
  storeCtrl.resize,
  storeCtrl.createStore
)
router.post(
  '/stores/:id/heart',
  requireAuth,
  userCtrl.refreshTokens,
  storeCtrl.heartStore
)
router.get(
  '/stores/fav',
  requireAuth,
  userCtrl.refreshTokens,
  storeCtrl.getFavStores
)
router.get(
  '/stores/top',
  requireAuth,
  userCtrl.refreshTokens,
  storeCtrl.getTopStores
)
router.get('/store/:slug', storeCtrl.getStore)
router.get('/stores/:page*?', storeCtrl.getStores)
router.get('/tags/:tag*?', storeCtrl.getTagsList)
router.post(
  '/update',
  storeCtrl.upload,
  storeCtrl.resize,
  storeCtrl.updateStore
)

router.post(
  '/reviews',
  requireAuth,
  userCtrl.refreshTokens,
  reviewCtrl.addReview
)

// 1. Validate data
// 2. Register the user
// 3. Log them in
router.post('/register', userCtrl.validateRegister, userCtrl.registerUser)

// 1. Validate data through passport
// 2. Log them in
router.post('/signin', requireSignIn, userCtrl.signin)

router.get('/signout', userCtrl.signout)

router.get('/secret', requireAuth, (req, res) => {
  res.send({ message: 'token auth success' })
})

// Do work here
router.get('/', (req, res) => {
  res.send('no access')
  // res.send({
  //   text:'Hey! It works!'
  // });
  // res.render('layout')
})

module.exports = router
