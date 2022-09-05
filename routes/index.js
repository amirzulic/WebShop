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
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  host: 'gmail',
  auth: {
    user: 'zulica7@gmail.com',
    pass: 'xbdvuxwprgbxcdqi'
  }
});

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
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`SELECT * FROM Category;`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.render('registration', { title: 'WebShop', categories: result.rows});
      }
    });
  });
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
    let interests = req.user.interests.split(",");
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM Product LIMIT 3;`, [], function (err, random) {
        done();
        if (err) {
          console.info(err);
        } else {
          pool.connect(function (err, client, done) {
            if (err) {
              res.end('{"error" : "Error", "status": 500}');
            }
            client.query(`SELECT * FROM Product p INNER JOIN Category c on p.category_id = c.category_id WHERE c.name = '${interests[0]}';`, [], function (err, recommended) {
              done();
              if (err) {
                console.info(err);
              } else {
                pool.connect(function (err, client, done) {
                  if (err) {
                    res.end('{"error" : "Error", "status": 500}');
                  }
                  client.query(`SELECT * FROM Product ORDER BY purchases DESC LIMIT 3;;`, [], function (err, popular) {
                    done();
                    if (err) {
                      console.info(err);
                    } else {
                      res.render('customerLandingPage', {
                        title: "WebShop",
                        user: req.user.first_name,
                        random: random.rows,
                        recommended: recommended.rows,
                        popular: popular.rows
                      });
                    }
                  });
                });
              }
            });
          });
        }
      });
    });
  } else if(req.user.user_type === 1) {
    res.redirect("/catalog");
    //res.render('sellerCatalog', {title: "WebShop", user: req.user});
  }  else {
    res.redirect("/users");
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

router.get('/profile/:id', checkAuthenticated, function(req, res, next) {
  let id = req.params.id;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`SELECT * FROM "User" WHERE user_id = '${id}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.render('otherUserProfile', {title: "WebShop", user: req.user, profile: result.rows})
      }
    });
  });
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
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM "Order" WHERE seller_id = '${req.user.user_id}';`, [], function (err, result) {
        done();
        if (err) {
          console.info(err);
        } else {
          res.render('sellerOrders', {title: "WebShop", user: req.user, orders: result.rows});
        }
      });
    });
  } else {
    res.render('error', {title: "WebShop"});
  }
});

router.get('/users', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 3) {
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM "User";`, [], function (err, result) {
        done();
        if (err) {
          console.info(err);
        } else {
          res.render('userList', {title: "WebShop", user: req.user, users: result.rows});
        }
      });
    });
  } else {
    res.render('error', {title: "WebShop"});
  }
});

router.get('/products/add', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 1) {
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT * FROM Category;`, [], function (err, result) {
        done();
        if (err) {
          console.info(err);
        } else {
          res.render('addProduct', {title: "WebShop", user: req.user, categories: result.rows});
        }
      });
    });
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
    client.query(`INSERT INTO Product(product_name, price, description, seller_id, category_id, purchases)
      VALUES ('${productName}', '${price}', '${description}', '${userId}', '${category}', 0);`, [], function (err, result) {
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
        pool.connect(function (err, client, done) {
          if (err) {
            res.end('{"error" : "Error", "status": 500}');
          }
          client.query(`UPDATE Product SET purchases = purchases + 1 WHERE product_id = '${productId}';`, [], function (err, result) {
            done();
            if (err) {
              console.info(err);
            } else {
              res.redirect("/");
            }
          });
        });
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
              var transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true, // use SSL
                auth: {
                  user: 'zulica7@gmail.com',
                  pass: ''
                }
              });
              var mailOptions = {
                from: 'zulica7@gmail.com',
                to: 'zulicic0@gmail.com',
                subject: 'WebShop Purchase',
                text: 'Your order is created! Wait for the store to accept it!'
              };
              transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                  console.log(error);
                } else {
                  console.log('Email sent: ' + info.response);
                }
              });
              res.redirect("/orders");
            }
          });
        });
      }
    });
  });
});

router.get('/statistics', checkAuthenticated, function(req, res, next) {
  if(req.user.user_type === 3) {
    let adminCount = 0;
    let sellerCount = 0;
    let customerCount = 0;
    let productCount = 0;
    let orderCount = 0;
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status": 500}');
      }
      client.query(`SELECT COUNT(user_id) from "User" WHERE user_type = 3;`, [], function (err, admin) {
        done();
        if (err) {
          console.info(err);
        } else {
          adminCount = admin.rows[0].count;
          pool.connect(function (err, client, done) {
            if (err) {
              res.end('{"error" : "Error", "status": 500}');
            }
            client.query(`SELECT COUNT(user_id) from "User" WHERE user_type = 2;`, [], function (err, customer) {
              done();
              if (err) {
                console.info(err);
              } else {
                customerCount = customer.rows[0].count;
                pool.connect(function (err, client, done) {
                  if (err) {
                    res.end('{"error" : "Error", "status": 500}');
                  }
                  client.query(`SELECT COUNT(user_id) from "User" WHERE user_type = 1;`, [], function (err, seller) {
                    done();
                    if (err) {
                      console.info(err);
                    } else {
                      sellerCount = seller.rows[0].count;
                      pool.connect(function (err, client, done) {
                        if (err) {
                          res.end('{"error" : "Error", "status": 500}');
                        }
                        client.query(`SELECT COUNT(product_id) from Product;`, [], function (err, product) {
                          done();
                          if (err) {
                            console.info(err);
                          } else {
                            productCount = product.rows[0].count;
                            pool.connect(function (err, client, done) {
                              if (err) {
                                res.end('{"error" : "Error", "status": 500}');
                              }
                              client.query(`SELECT COUNT(order_id) from "Order";`, [], function (err, order) {
                                done();
                                if (err) {
                                  console.info(err);
                                } else {
                                  orderCount = order.rows[0].count;
                                  res.render('adminStatistics', {
                                    title: "WebShop",
                                    user: req.user,
                                    adminCount: adminCount,
                                    sellerCount: sellerCount,
                                    customerCount: customerCount,
                                    productCount: productCount,
                                    orderCount: orderCount
                                  });
                                }
                              });
                            });
                          }
                        });
                      });
                    }
                  });
                });
              }
            });
          });
        }
      });
    });
  } else {
    res.render('error', {title: "WebShop"});
  }
});

router.post('/search', checkAuthenticated, function(req, res, next) {
  let search = req.body.search;
  res.redirect("/search-result/" + search)
});

router.get('/search-result/:search', checkAuthenticated, function(req, res, next) {
  let search = req.params.search;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`SELECT * FROM Product WHERE product_name LIKE '%${search}%';`, [], function (err, products) {
      done();
      if (err) {
        console.info(err);
      } else {
        pool.connect(function (err, client, done) {
          if (err) {
            res.end('{"error" : "Error", "status": 500}');
          }
          client.query(`SELECT * FROM "User" WHERE first_name LIKE '%${search}%';`, [], function (err, users) {
            done();
            if (err) {
              console.info(err);
            } else {
              res.render('search', {title: "WebShop", user: req.user, products: products.rows, users: users.rows});
            }
          });
        });
      }
    });
  });
});

router.post('/change-name', checkAuthenticated, function(req, res, next) {
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`UPDATE "User" SET first_name = '${firstName}', last_name = '${lastName}' WHERE user_id = ${req.user.user_id};`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/profile");
      }
    });
  });
});

router.post('/change-email', checkAuthenticated, function(req, res, next) {
  let email = req.body.email;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`UPDATE "User" SET email = '${email}' WHERE user_id = ${req.user.user_id};`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/profile");
      }
    });
  });
});

router.post('/accept-order/:id', checkAuthenticated, function(req, res, next) {
  let orderId = req.params.id;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`UPDATE "Order" SET status = 2 WHERE order_id = ${orderId};`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        var transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // use SSL
          auth: {
            user: 'zulica7@gmail.com',
            pass: ''
          }
        });
        var mailOptions = {
          from: 'zulica7@gmail.com',
          to: 'zulicic0@gmail.com',
          subject: 'WebShop Purchase',
          text: 'Your order accepted! You will be hearing from us soon!'
        };
        transporter.sendMail(mailOptions, function(error, info){
          if (error) {
            console.log(error);
          } else {
            console.log('Email sent: ' + info.response);
          }
        });
        res.redirect("/orders");
      }
    });
  });
});

router.post('/delivered/:id', checkAuthenticated, function(req, res, next) {
  let orderId = req.params.id;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`UPDATE "Order" SET status = 3 WHERE order_id = ${orderId};`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/orders");
      }
    });
  });
});

router.post('/delete-order/:id', checkAuthenticated, function(req, res, next) {
  let orderId = req.params.id;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`DELETE FROM "Order" WHERE order_id = '${orderId}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/orders");
      }
    });
  });
});

router.post('/send-message/:id', checkAuthenticated, function(req, res, next) {
  let userId = req.params.id;
  let message = req.body.message;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`INSERT INTO Message(sender, user_id, message)
      VALUES ('${req.user.first_name}', '${userId}', '${message}');`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/");
      }
    });
  });
});

router.get('/messages', checkAuthenticated, function(req, res, next) {
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`SELECT * FROM Message WHERE user_id = '${req.user.user_id}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.render('messages', {title: "WebShop", user: req.user, messages: result.rows});
      }
    });
  });
});

router.post('/delete-product/:id', checkAuthenticated, function(req, res, next) {
  let productId = req.params.id;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`DELETE FROM Product WHERE product_id = '${productId}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/catalog");
      }
    });
  });
});

router.post('/block-user/:id', checkAuthenticated, function(req, res, next) {
  let userId = req.params.id;
  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status": 500}');
    }
    client.query(`DELETE FROM "User" WHERE user_id = '${userId}';`, [], function (err, result) {
      done();
      if (err) {
        console.info(err);
      } else {
        res.redirect("/");
      }
    });
  });
});

module.exports = router;
