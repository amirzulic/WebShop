var express = require('express');
var router = express.Router();
var pg = require('pg');
const bcrypt = require('bcrypt');
const saltRounds = 10;
let alert = require('alert');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');

router.use(flash());
router.use(session({
  secret: 'some_weird_secret',
  resave: false,
  saveUninitialized: false
}))
router.use(passport.initialize());
router.use(passport.session());
router.use(methodOverride('_method'));

var config = {
  user: 'bylrcvnk', //env var: PGUSER
  database: 'bylrcvnk', //env var: PGDATABASE
  password: '1BQF93bsUKqyiCjo6O9fYDZ6lEqJUKR5', //env var: PGPASSWORD
  host: 'tai.db.elephantsql.com', // Server hosting the postgres database
  port: 5432, //env var: PGPORT
  max: 100, // max number of clients in the pool
  idleTimeoutMillis: 10, // how long a client is allowed to remain idle before being closed
};
var pool = new pg.Pool(config);

const initializePassport = require('../passport-config');
initializePassport(passport);

function checkAuthenticated(req, res, next) {
  if(req.isAuthenticated()) {
    return next()
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if(req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

/* GET home page. */
router.get('/', checkAuthenticated, function(req, res, next) {
  res.render('index', { title: 'Express', name: req.user.first_name});
});

router.get('/login', checkNotAuthenticated, function(req, res, next) {
  res.render('login', { title: 'Express' });
});

router.get('/registration', checkNotAuthenticated, function(req, res, next) {
  res.render('registration', { title: 'Express' });
});

router.post('/register', checkNotAuthenticated, function(req, res, next) {
  let firstName = req.body.firstName
  let lastName = req.body.lastName
  let interests = req.body.interestOne + "," + req.body.interestTwo + "," + req.body.interestThree
  let email = req.body.email;
  let password = req.body.password;
  let userType = req.body.userType

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
      bcrypt.hash(password, saltRounds, function(err, hash) {
        client.query(`INSERT INTO "User"(first_name, last_name, interests, email, password, user_type)
      VALUES ('${firstName}', '${lastName}', '${interests}', '${email}', '${hash}', '${userType}');`, [], function(err, result) {
          done();
          if (err) {
            console.info(err);
          } else {
            res.redirect("/");
          }
        });
      });
  });
});

router.post('/prikazi', checkNotAuthenticated, passport.authenticate('local', {
  failureFlash: true
}), function (req, res) {
  res.redirect("/");
});

router.delete('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

module.exports = router;
