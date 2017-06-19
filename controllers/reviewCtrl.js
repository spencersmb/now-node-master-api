const mongoose = require('mongoose')
const Store = mongoose.model('Store')
const User = mongoose.model('User')
const Review = mongoose.model('Review')
const authUtils = require('../utils/authUtils')

exports.addReview = async (req, res) => {
  const reviewObj = {
    store: req.body.postId,
    author: req.user._id,
    rating: parseInt(req.body.rating),
    text: req.body.text
  }

  const review = new Review(reviewObj)

  try {
    const response = await review.save()
    const update = authUtils.checkForTokenRefresh(response, res.locals.token)
    return res.send(update)
  } catch (e) {
    return res.status(422).send({ error: e.message })
  }
}
