const express = require('express');
const router = express.Router({ mergeParams: true });
const catchAsync = require('../utils/catchAsync');
const Travel = require('../models/travels');
const flags = require('../seeds/flags');
const { isLoggedIn, isAuthor } = require('../middleware.js');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });


router.get('/', isLoggedIn, catchAsync(async (req, res) => {
    //const user = await Travel.findById().populate('author')
    const mytravels = await Travel.find({ author: req.user._id }).populate('author');
    console.log('-<-<-<: ' + mytravels);
    res.render('Travels/index', { mytravels });
}))

router.post('/', isLoggedIn, catchAsync(async (req, res) => {
    const insert = req.body.travel;
    const travel = new Travel(insert);
    const mytravels = await Travel.find({ author: req.user._id });
    let isCountrySaved = new Boolean(false);
    let isCitySaved = new Boolean(false);
    isCountrySaved = searchCountry(travel, mytravels);
    if (isCountrySaved == false) {
        assignFlag(travel, flags);
        travel.orderNr.push(1);
        travel.author = req.user._id;
        const geoData = await geocoder.forwardGeocode({
            query: insert.city,
            limit: 1
        }).send();
        travel.geometry.push(geoData.body.features[0].geometry);
        travel.save();
        req.flash('success', 'New travel saved');
        res.redirect('/mytravels');
    } else {
        const countryDB = await Travel.findOne({ country: travel.country, author: req.user._id });
        isCitySaved = searchCity(travel, insert, countryDB);
        if (isCitySaved == true) {
            req.flash('error', 'City already exist');
            res.redirect('/mytravels');
            return;
        } else if (isCitySaved == false) {
            console.log("Inserted city " + insert.city);
            countryDB.city.push(insert.city);
            countryDB.arrival.push(insert.arrival);
            countryDB.departure.push(insert.departure);
            assignOrderNr(travel, countryDB);
            await countryDB.save();
            req.flash('success', 'New city saved');
            res.redirect(`/mytravels/${countryDB._id}`);
        }
    }

}));

router.get('/new', isLoggedIn, (req, res) => {
    res.render('Travels/new');
})

router.get('/:id', isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id);
    res.render('Travels/show', { travel });
}))

router.delete('/:id', isLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    const insert = req.body.travel;
    const travel = new Travel(insert);
    await Travel.findByIdAndDelete(id);
    req.flash('success', 'Travel has been deleted');
    res.redirect('/mytravels');
}))


router.post('/:id/edit', isAuthor, isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id).populate('reviews');
    const insert = req.body.travel;
    /*const travelo = new Travel(travel);*/
    const reviewSelect = req.body.review;
    travel.cityid = insert.cityid;
    travel.save();
    req.flash('success', 'Travel has been edited');
    /*console.log("---->" + traveli + " - " + travel.cityid);*/
    res.render('Travels/edit', { travel, reviewSelect });
}));

router.post('/:id/edit/select', isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id).populate({
        path: 'reviews',
        populate: 'author'

    }).populate('author');
    const reviewSelect = req.body.review;
    res.render('Travels/edit', { reviewSelect, travel });
}))

router.put('/:id', isLoggedIn, catchAsync(async (req, res) => {
    let insert = req.body.travel;
    let travel = new Travel(insert);
    let countryDB = await Travel.findOne({ country: travel.country });
    travel._id = countryDB._id;

    /*const { id } = req.params;*/
    console.log("countryDB = " + countryDB);
    let orderIndex = travel.cityid;
    console.log("orderIndex = " + orderIndex);
    let arrivalDate = travel.arrival[0];
    let arrivalDateCon = new Date(arrivalDate).getTime();
    let arrivalDateDB = countryDB.arrival[orderIndex];
    let arrivalDateDBCon = new Date(arrivalDateDB).getTime();
    console.log("inserted arrival = " + arrivalDateCon + " arrival DB = " + arrivalDateDBCon);
    if (arrivalDateCon == arrivalDateDBCon) {
        countryDB.city[orderIndex] = travel.city[0];
        countryDB.departure[orderIndex] = travel.departure[0];
    } else if (arrivalDateCon !== arrivalDateDBCon) {
        deleteCity(travel, countryDB);
        isCitySaved = searchCity(travel, insert, countryDB);
        if (isCitySaved == true) {
            req.flash('error', 'City already exist');
            res.redirect('/mytravels');
        } else if (isCitySaved == false) {
            console.log("Inserted city " + insert.city);
            countryDB.city.push(insert.city);
            countryDB.arrival.push(insert.arrival);
            countryDB.departure.push(insert.departure);
            assignOrderNr(travel, countryDB);
            await countryDB.save();
            req.flash('success', 'New city saved');
        }
    }
    /*res.redirect('/mytravels');*/
    res.redirect(`/mytravels/${travel._id}`);
}))

router.get('/:id/addcities', isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id);
    console.log("travel = " + travel)
    res.render('Travels/addcities', { travel });
}))

router.post('/:id/showcity', isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author');
    const insert = req.body.travel;
    const reviewSelect = req.body.review;
    travel.cityid = insert.cityid;
    travel.save();
    res.render('Travels/showcity', { travel, reviewSelect });
}));

router.post('/:id/showcity/select', isLoggedIn, catchAsync(async (req, res) => {
    const travel = await Travel.findById(req.params.id).populate({
        path: 'reviews',
        populate: 'author'

    }).populate('author');
    const reviewSelect = req.body.review;
    res.render('Travels/showcity', { reviewSelect, travel });
}))

router.delete('/:id/showcity', isLoggedIn, catchAsync(async (req, res) => {
    const travel = new Travel(req.body.travel);
    const countryDB = await Travel.findOne({ country: travel.country });
    console.log("countryDB: " + countryDB);
    console.log("travel" + travel);
    deleteCity(travel, countryDB);
    await countryDB.save();
    req.flash('success', 'City has been deleted');
    res.redirect(`/mytravels/${countryDB._id}`);
    /*res.redirect('/mytravels');*/
}))

/*Methods for adding and deleting travels*/

function searchCountry(travel, travels) {
    let countryPresent = new Boolean(false);
    for (let traveled of travels) {
        console.log(travel.country + " - " + traveled.country);
        if (travel.country == traveled.country) {
            countryPresent = true;
        }
    }
    console.log("IsCountryPresent = " + countryPresent);
    return countryPresent;
}

function searchCity(travel, insert, countryDB) {
    console.log(countryDB);
    let cityPresent = new Boolean(false);
    for (let i = 0; i < countryDB.city.length; i++) {
        console.log(travel.city + " - " + countryDB.city[i]);
        if (travel.city == countryDB.city[i]) {
            cityPresent = true;
        }
    }
    console.log("IsCityPresent = " + cityPresent);
    return cityPresent;
}

async function deleteCity(travel, countryDB) {
    console.log("cityid = " + travel.cityid);
    let deleteOrderNr = countryDB.orderNr[travel.cityid];
    countryDB.city.splice(travel.cityid, 1);
    countryDB.arrival.splice(travel.cityid, 1);
    countryDB.departure.splice(travel.cityid, 1);
    countryDB.orderNr.splice(travel.cityid, 1);
    for (let i = 0; i < countryDB.arrival.length; i++) {
        console.log("i = " + i);
        if (countryDB.orderNr[i] > deleteOrderNr) {
            console.log("countryDB vorher = " + countryDB.orderNr[i])
            countryDB.orderNr[i] = countryDB.orderNr[i] - 1;
            console.log("countryDB nachher = " + countryDB.orderNr[i])
        }
    }
    console.log("Left cities: " + countryDB.city)
}


async function assignFlag(travel, flags) {
    for (let i = 0; i < flags.length; i++) {
        if (travel.country == flags[i].country) {
            travel.flagurl = flags[i].href;
            await travel.save();
            console.log("New travel object: " + travel);
            console.log(travel.flagurl + " is now " + flags[i].href);
        }
    }
}

function assignOrderNr(travel, countryDB) {
    let newOrderNr = 0;
    let imax = 0;
    const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    /*let arrivalDate = travel.arrival[0].toLocaleDateString('de-DE', options);*/
    let arrivalDate = travel.arrival[0];
    let arrivalDateCon = new Date(arrivalDate).getTime();


    if (countryDB.orderNr.length == 0) {
        countryDB.orderNr.push(1);
        console.log("orderNr = 1")
    }
    /*test*/
    for (let i = 0; i < countryDB.arrival.length - 1; i++) {
        /*let arrivalDateDB = countryDB.arrival[i].toLocaleDateString('de-DE', options);*/
        let arrivalDateDB = countryDB.arrival[i];
        let arrivalDateDBCon = new Date(arrivalDateDB).getTime();
        if (arrivalDateCon >= arrivalDateDBCon && countryDB.orderNr[i] >= newOrderNr) {
            newOrderNr = countryDB.orderNr[i] + 1;
            console.log("it worked");
        } else if (arrivalDateCon <= arrivalDateDBCon && countryDB.arrival.length == 2) {
            countryDB.orderNr[0] = countryDB.orderNr[0] + 1;
            newOrderNr = 1;
        }
        console.log("newOrder = " + newOrderNr);
    }
    /*test*/
    for (let i = 0; i < countryDB.arrival.length - 1; i++) {
        console.log("i = " + i + " array length = " + countryDB.arrival.length);
        /*let arrivalDateDB = countryDB.arrival[i].toLocaleDateString('de-DE', options);*/
        let arrivalDateDB = countryDB.arrival[i];
        let arrivalDateDBCon = new Date(arrivalDateDB).getTime();
        console.log("inserted date = " + arrivalDateCon + " compared date = " + arrivalDateDBCon);
        if (arrivalDateCon >= arrivalDateDBCon) {
            /* if (countryDB.orderNr[i] > newOrderNr) {
                newOrderNr = countryDB.orderNr[i] + 1;
            } */
            imax = i;
            console.log("imax = " + imax + "new orderNr = " + newOrderNr + " over " + countryDB.orderNr[i])

        } else if (arrivalDateCon < arrivalDateDBCon && countryDB.arrival.length > 2) {
            console.log("newOrderNr in else = " + newOrderNr);
            for (let k = imax; k <= countryDB.arrival.length - 2; k++) {
                console.log("k = " + k);
                if (countryDB.orderNr[k + 1] >= newOrderNr && newOrderNr > 0) {
                    countryDB.orderNr[k + 1] = countryDB.orderNr[k + 1] + 1;
                } else if (newOrderNr == 0) {
                    countryDB.orderNr[k] = countryDB.orderNr[k] + 1;
                }

                i++;
                console.log("new countryDB for place " + (k + 1) + " = " + countryDB.orderNr[k + 1]);
            }
        }
    }
    if (newOrderNr == 0) {
        countryDB.orderNr.push(1);

    } else {
        countryDB.orderNr.push(newOrderNr);

    }
    return;
}

module.exports = router;