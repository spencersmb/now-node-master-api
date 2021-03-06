const mongoose = require('mongoose')
const Store = mongoose.model('Store')
const User = mongoose.model('User')
const ImageUploader = require('../utils/ImageUploader')
const slug = require('slugs') //wordpress permalink?
const multer = require('multer')
const sharp = require('sharp')
const authUtils = require('../utils/authUtils')

// define where to store and what types are allowed
const multerOptions = {
  storage: multer.memoryStorage(), //save into mem so we can resize and then save to disk
  fileFilter(req, file, next) {
    console.log('muler')
    console.log(file)

    const isPhoto = file.mimetype.startsWith('image/')
    if (isPhoto) {
      console.log(isPhoto)
      console.log(file)

      // next(error, worked)
      next(null, true)
    } else {
      next({ message: 'that file type isnt allowed' }, false)
    }
  }
}

// middleware fo uploading images
// upload stores our image in mem temporarily for a single photo and then moves to next middleware to resize
// upload also checks file type for security
exports.upload = multer(multerOptions).single('photo')
exports.resize = async (req, res, next) => {
  // check if there is no new file to resize when we save
  // multer automatically knows if a file was uploaded
  // multer puts the file property on the request

  if (!req.file) {
    next() // no file so skip to the next middleware
    return
  }

  try {
    console.log('starting resize image')
    console.log(req.file)

    // Resize photo
    const photo = await sharp(req.file.buffer).resize(800).toBuffer()

    //1 pass in file to new Class()
    const s3File = new ImageUploader.S3Loader(req.file)

    //2 new class returns path
    req.body.photo = s3File.getUrlPath()

    //3 data is stored in class passing in the edited photo buffer - save/upload
    s3File.uploadPhoto(photo, () => {
      next()
    })
  } catch (e) {
    console.log('error try catch')
    console.log(e)

    next()
    return
  }
}

exports.createStore = async (req, res) => {
  console.log('create Store body')
  // console.log(req)
  console.log(req.body)

  //Add Author after the fact using JWT on the server
  req.body.author = req.authInfo.decodedUser.sub

  try {
    const store = new Store(req.body)
    const response = await store.save()
    const update = authUtils.checkForTokenRefresh(response, res.locals.token)
    return res.send(update)
  } catch (e) {
    // Weird object for mongoose error handeling
    return res.status(422).send({ error: e.errors.name.message })
  }
}

exports.getStores = async (req, res) => {
  const page = req.params.page || 1

  const limit = 6
  // 1 * 6 - 6 = page 0 - skip none
  // 2 * 6 - 6 = page 2 skip the first 6
  const skip = page * limit - limit

  try {
    const storesPromise = Store.find()
      .skip(skip)
      .limit(limit)
      // .sort({ created: 'desc' })
      .sort([['_id', -1]])

    const countPromise = Store.count()
    const [stores, count] = await Promise.all([storesPromise, countPromise])
    const totalPages = Math.ceil(count / limit)
    // const update = authUtils.checkForTokenRefresh(store, null)

    return res.send({ stores, count, totalPages })
  } catch (e) {
    return res.status(422).send({ message: e.message })
  }
}

exports.getStore = async (req, res) => {
  const allowedFields = ['_id', 'name']
  const allowedReviewsFields = ['store', 'text', 'rating', 'author', 'created']

  try {
    const store = await Store.findOne({
      slug: req.params.slug
    })

    const update = authUtils.checkForTokenRefresh(store, null)

    return res.send(update)
  } catch (e) {
    return res.status(422).send({ message: e.message })
  }
}

exports.updateStore = async (req, res) => {
  console.log('updateStore - photo?')
  console.log(req.body.photo)

  try {
    //query, data, options
    const store = await Store.findOneAndUpdate(
      { _id: req.body._id },
      req.body,
      {
        new: true, // returns new store and update
        runValidators: true // make sure all properties that need to be there are validated
      }
    ).exec() //execute query and returns a promise
    return res.send({ store })
  } catch (e) {
    return res.status(422).send({ message: e.message })
  }
}

exports.getFavStores = async (req, res) => {
  const user = req.user
  const favStores = await Store.find({ _id: { $in: user.hearts } })
  const update = authUtils.checkForTokenRefresh(favStores, null)

  return res.send(update)
}

exports.getTagsList = async (req, res) => {
  try {
    const tag = req.params.tag
    const tagQuery = tag !== 'undefined' ? tag : { $exists: true } // if no tag - use query to return us any store with at least 1 tag

    // example of multiple promieses sent and resolved
    const tagsPromise = Store.getTagsList()
    const storesPromise = Store.find({ tags: tagQuery })

    const results = await Promise.all([tagsPromise, storesPromise])

    return res.send(results)
  } catch (e) {
    return res.status(422).send({ message: e.message })
  }
}

exports.searchStore = async (req, res) => {
  console.log('req')
  console.log(req.query.q)
  const stores = await Store
    // Find stores
    .find(
      {
        // text is the operator - I think corrosponds to index type
        $text: {
          $search: req.query.q
        }
      },
      {
        score: { $meta: 'textScore' }
      }
    )
    // Sort by score
    .sort({
      score: { $meta: 'textScore' }
    })
    // limit by 5
    .limit(5)

  return res.json(stores)
}

exports.heartStore = async (req, res) => {
  console.log('req')
  console.log(req.params.id)
  console.log('user')
  console.log(req.user)

  // Get list of current hearts on the auth'd User
  const hearts = req.user.hearts.map(heartObj => heartObj.toString())
  console.log(hearts)

  // does heart exist in the current user?
  // $addToSet is like push but wont add duplicates
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet'

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [operator]: { hearts: req.params.id } },
    { new: true }
  )

  const update = authUtils.checkForTokenRefresh(user.hearts, null)

  return res.send(update)
}

exports.getTopStores = async (req, res) => {
  try {
    const stores = await Store.getTopStores()
    const update = authUtils.checkForTokenRefresh(stores, null)
    res.send(update)
  } catch (e) {
    return res.status(422).send({ message: e.message })
  }
}
