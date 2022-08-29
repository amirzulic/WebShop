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
router.get('/old', checkAuthenticated, function(req, res, next) {
  res.render('index', { title: 'WebShop', name: req.user.first_name});
});

router.get('/login', checkNotAuthenticated, function(req, res, next) {
  res.render('login', { title: 'WebShop' });
});

router.get('/registration', checkNotAuthenticated, function(req, res, next) {
  res.render('registration', { title: 'WebShop' });
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

router.post('/log', checkNotAuthenticated, passport.authenticate('local', {
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

router.get('/', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 2) {
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM Product LIMIT 3;`, [], function (err, result) {
        done();
        if (err) {
          console.info(err);
        } else {
          res.render('customerLandingPage', {title: "WebShop", user: req.user.first_name, product: result.rows});
        }
      });
    });
  } else if(req.user.user_type === 1) {
    res.redirect("/catalog");
    //res.render('sellerCatalog', {title: "WebShop", user: req.user});
  }  else {
    res.render('userList', {title: "WebShop", user: req.user.first_name});
  }
});

router.get('/product/:id', checkAuthenticated, function(req, res, next) {
  let id = req.params.id

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`SELECT * FROM Product WHERE product_id = '${id}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        console.info(result.rows);
        res.render('singleProduct', {title: "WebShop", user: req.user, product: result.rows});
      }
    });
  });
});

router.get('/basket', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 2) {
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM Basket b INNER JOIN "User" u on b.user_id = u.user_id INNER JOIN product p on b.product_id = p.product_id;`, [], function (err, result) {
        done();
        if (err) {
          console.info(err);
        } else if(result.rows.length > 0) {
          let products = "";
          for (let i = 0; i < result.rows.length; i++) {
            if (i === result.rows.length - 1) {
              products += result.rows[i].product_name
            } else {
              products += result.rows[i].product_name + ", "
            }
          }
          res.render('basket', {title: "WebShop", name: req.user.first_name, basket: result.rows, products: products});
        } else {
          res.render('basketEmpty', {title: "WebShop", name: req.user.first_name});
        }
      });
    });
  } else {
    res.render('error', {title: "WebShop"});
  }
})

router.get('/profile', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 2) {
    res.render('customerProfile', {title: "WebShop", user: req.user});
  } else if(req.user.user_type === 1) {
    res.render('sellerProfile', {title: "WebShop", user: req.user});
  } else {
    res.render('adminProfile', {title: "WebShop", user: req.user})
  }
});

router.get('/catalog', checkAuthenticated, function(req, res, next) {
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`SELECT * FROM Product WHERE seller_id = '${req.user.user_id}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        console.info(result.rows)
        res.render('sellerCatalog', {title: "WebShop", user: req.user, products: result.rows});
      }
    });
  });
});

router.get('/orders', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 2) {
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM "Order" WHERE customer_id = '${req.user.user_id}';`, [], function (err, result) {
        done();
        if (err) {
          console.info(err);
        } else {
          res.render('customerOrders', {title: "WebShop", user: req.user, products: result.rows});
        }
      });
    });
  } else if(req.user.user_type === 1) {
    res.render('sellerOrders', {title: "WebShop", user: req.user});
  } else {
    res.render('error', {title: "WebShop"});
  }
});

router.get('/users', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 3) {
    res.render('userList', {title: "WebShop", user: req.user});
  } else {
    res.render('error', {title: "WebShop"});
  }
});

router.get('/products/add', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 1) {
    res.render('addProduct', {title: "WebShop", user: req.user});
  } else {
    res.render('error', {title: "WebShop"});
  }
});

router.post('/add-product', checkAuthenticated, function(req, res, next) {
  let productName = req.body.productName
  let price = req.body.price
  let category = req.body.category
  let description = req.body.description
  let userId = req.user.user_id

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`INSERT INTO Product(product_name, price, product_category, description, seller_id)
      VALUES ('${productName}', '${price}', '${category}', '${description}', '${userId}');`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/");
      }
    });
  });
});

router.post('/add-to-basket/:id', checkAuthenticated, function(req, res, next) {
  let userId = req.user.user_id;
  let productId = req.params.id;

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`INSERT INTO Basket(user_id, product_id)
      VALUES ('${userId}', '${productId}');`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/");
      }
    });
  });
});

router.post('/create-order/:products/:seller', checkAuthenticated, function(req, res, next) {
  let customerId = req.user.user_id;
  let products = req.params.products;
  let sellerId = req.params.seller;
  let status = 1;

  console.info(products);
  console.info(sellerId);

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`INSERT INTO "Order"(customer_id, seller_id, products, status)
      VALUES ('${customerId}', '${sellerId}', '${products}', '${status}');`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        pool.connect(function (err, client, done) {
          if (err) {
            res.end('{"error" : "Error", "status": 500}');
          }
          client.query(`DELETE FROM Basket WHERE user_id = '${customerId}';`, [], function (err, result) {
            done();
            if (err) {
              console.info(err);
            } else {
              res.redirect("/orders");
            }
          });
        });
      }
    });
  });
});
module.exports = router;
