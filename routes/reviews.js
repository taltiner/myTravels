const express = require('express');
const router = express.Router({ mergeParams: true });
const catchAsync = require('../utils/catchAsync');
const Travel = require('../models/travels');
const Review = require('../models/review');
const { isLoggedIn } = require('../middleware.js');
const multer = require('multer');
const { storage } = require('../cloudinary');
const { cloudinary } = require('../cloudinary');
const upload = multer({ storage });

router.post('/', isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id);
    const insert = req.body.travel;
    travel.cityid = insert.cityid;
    travel.save();
    res.render('Travels/reviews', { travel });
}))

router.post('/new', isLoggedIn, upload.array('image'), catchAsync(async (req, res) => {
    const countryDB = await Travel.findById(req.params.id).populate('reviews');
    const review = new Review(req.body.review);
    for (let reviewActivity of countryDB.reviews) {
        if (reviewActivity.activity == review.activity) {
            req.flash('error', 'You have already rated this activity');
            res.redirect(`/mytravels/${countryDB._id}`);
            return;
        }
    }
    review.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    review.author = req.user._id;
    countryDB.reviews.push(review);
    await review.save();
    await countryDB.save();
    req.flash('success', 'Created new review');
    res.redirect(`/mytravels/${countryDB._id}`);
}))

router.put('/:reviewId', isLoggedIn, upload.array('image'), catchAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    const review = new Review(req.body.review);
    const reviewDB = await Review.findByIdAndUpdate(reviewId, { "$set": { "activity": review.activity, "comment": review.comment, "rating": review.rating } });
    const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
    //spread array so it pushes the data from it not the array itself
    reviewDB.images.push(...imgs);
    await reviewDB.save();
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await reviewDB.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
    };
    req.flash('success', 'Review has been edited');
    res.redirect(`/mytravels/${id}`);
}))

router.delete('/:reviewId', isLoggedIn, catchAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    await Travel.findByIdAndUpdate(id, { $pull: { reviews: reviewId } })
    await Review.findByIdAndDelete(req.params.reviewId);
    req.flash('success', 'Review has been deleted');
    res.redirect(`/mytravels/${id}`);

}))


module.exports = router;