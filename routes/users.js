const express = require('express');
const passport = require('passport');
const User = require('../models/user');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');

router.get('/register', (req, res) => {
    res.render('users/register');
});

router.post('/register', catchAsync(async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'You have been Successfully registered');
            res.redirect('mytravels');
        })
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/register');
    }
}));

router.get('/login', (req, res) => {
    res.render('users/login');
});

router.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login', keepSessionInfo: true }), (req, res) => {
    const redirectUrl = req.session.returnTo || '/mytravels';
    req.flash('success', 'Welcome back!');
    delete req.session.returnTo;
    res.redirect(redirectUrl);
});

router.get('/logout', (req, res, next) => {
    req.logOut(function (err) {
        if (err) { return next(err); }
        req.flash('success', 'You have been logged out');
        res.redirect('/login');
    });
})

module.exports = router;