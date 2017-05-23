const express = require('express')
const router = express.Router()
const storeCtrl = require('../controllers/storeCtrl.js')
const userCtrl = require('../controllers/userCtrl.js')
const passportServices = require('../controllers/passportCtrl')
const passport = require('passport')

const requireAuth = passport.authenticate('jwt', { session: false })
const requireSignIn = passport.authenticate('local', { session: false })

// chain functions for uploading images -> data
router.post('/add', storeCtrl.upload, storeCtrl.resize, storeCtrl.createStore)
router.get('/store/:slug', storeCtrl.getStore)
router.get('/stores', storeCtrl.getStores)
router.get('/tags/:tag*?', storeCtrl.getTagsList)
router.post(
  '/update',
  storeCtrl.upload,
  storeCtrl.resize,
  storeCtrl.updateStore
)

// 1. Validate data
// 2. Register the user
// 3. Log them in
router.post('/register', userCtrl.validateRegister, userCtrl.registerUser)

// 1. Validate data through passport
// 2. Log them in
router.post('/signin', requireSignIn, userCtrl.signin)

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
