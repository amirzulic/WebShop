const LocalStrategy = require('passport-local').Strategy
var pg = require('pg');
const bcrypt = require('bcrypt');

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

function initialize(passport) {
    const authenticateUser = (email, password, done) => {
        pool.query(`SELECT * FROM "User" WHERE email = '${email}';`, [], function (err, result) {
            if (err) {
                console.info(err);
            }
            if (result.rows.length > 0) {
                const user = result.rows[0];
                bcrypt.compare(password, user.password, function (err, hashres) {
                    if (hashres) {
                        return done(null, user);
                    } else {
                        return done(null, false, {message: "Password incorrect!"});
                    }
                })
            } else {
                return done(null, false, {message: "User not found!"});
            }
        });
    }

    passport.use('local', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password'
        }, authenticateUser));

    passport.serializeUser((user, done) => {
        console.info("serialize")
        done(null, user.user_id);
    })
    passport.deserializeUser((id, done) => {
        pool.query(`SELECT * FROM "User" WHERE user_id = '${id}';`, [], function (err, result) {
            if (err) {
                console.info(err);
            }
            return done(null, result.rows[0]);
        });
    })
}

module.exports = initialize
