var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const session = require("express-session");
const { authCustomer } = require('./Authorizations');
const multer = require('multer');
const nodemailer = require('nodemailer');

//Connecting to the ElephantSQL DataBase
const { Pool, Client } = require('pg')
const {route} = require("express/lib/router");
const bodyParser = require("body-parser");
const path = require("path");
const {max} = require("pg/lib/defaults");
const app = require("../app");
const req = require("express");
const pool = new Pool({
    user: 'uijvqpvp',
    host: 'ella.db.elephantsql.com',
    database: 'uijvqpvp',
    password: 'TQNc3M530lNpfFl6aj3O1LUH1KYpkrbK',
    port: 5432,
    max: 10,
    idleTimeoutMillis: 3000
})


const sendMail = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: 'ouvrierwebshop@gmail.com',
        pass: '2846webshop',
    }, tls: {
        rejectUnauthorized: false
    }
})
const  storage = multer.diskStorage({
    destination: './public/images/Customers_profile_pictures',
    filename: function (req, file, cb) {
        cb(null, req.body.username + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage
})

var alert, cartmsg;
var admin = 0, customer = 1, merchant = 2;

var dataBaseObject = {
    insertCustomer : function (req, res, next) {
        if(req.body.firstname.length === 0 || req.body.lastname.length === 0 || req.body.email.length === 0 || req.body.interest.length === 0
        || req.body.username.length === 0 || req.body.password.length === 0) {
                alert = 'Fill out all the form fields!';
                res.redirect('/customers/customerRegister');
        }
        else {
            pool.query(`select * from customers where email = $1`, [req.body.email],
                (err, result) => {
                    if (result.rows.length === 0) {
                        pool.query(
                            `select * from customers where username = $1`, [req.body.username],
                            (err, result) => {
                                if (result.rows.length !== 0) {
                                    alert = 'Username already exists!';
                                    res.redirect('/customers/customerRegister');
                                } else if (result.rows.length === 0) {
                                        pool.query(`insert into customers (first_name, last_name, email, interests, username, password, profile_photo) values 
                                        ($1, $2, $3, $4, $5, $6, $7)`, [req.body.firstname, req.body.lastname, req.body.email, req.body.interest,
                                                req.body.username, bcrypt.hashSync(req.body.password, 10), req.file.filename],
                                            (err, result) => {
                                                req.session.customer = req.body.username;
                                                req.session.interests = req.body.interest;
                                                alert = undefined;
                                                res.redirect('/customers/customerPage');
                                        })
                                }
                            });
                    }
                    else if (result.rows[0].length !== 0) {
                        alert = 'Email already exists!';
                        res.redirect('/customers/customerRegister');
                    }
                })
        }
    },
    logInCustomer : function (req, res, next) {
        if (req.body.username.length === 0 || req.body.password.length === 0) {
            res.render('Customers/customerLogin', {title: 'Log in', alert: 'Please fill in all the form fields.'})
        }
        else {
            pool.query(`select * from customers where username = $1`, [req.body.username],
                (err, result) => {
                    if (result.rows.length === 0) {
                        res.render('Customers/customerLogin', {title: 'Log in', alert: 'Username does not exist.'})
                    }
                    else if(result.rows[0].username === req.body.username &&
                        !bcrypt.compareSync(req.body.password, result.rows[0].password)) {
                        res.render('Customers/customerLogin', {title: 'Log in', alert: 'Wrong password.'})
                    }
                    else if (result.rows[0].username === req.body.username &&
                        bcrypt.compareSync(req.body.password, result.rows[0].password)) {
                        if(result.rows[0].status === 'blocked') {
                            res.render('Customers/customerLogin', {title: 'Log in', alert: 'Your profile has been blocked by the admin!'})
                        }
                        else if(result.rows[0].status === 'archived') {
                            res.render('Customers/customerLogin', {title: 'Log in', alert: 'Your profile has been permanently deleted by the admin!'})
                        }
                        else {
                            req.session.customer = req.body.username;
                            req.session.interests = result.rows[0].interests;
                            req.session.customer_id = result.rows[0].customer_id;
                            alert = undefined;
                            res.redirect('/customers/customerPage');
                        }
                    }
                })
        }
    },
    selectCategories : function (req, res, next) {
        pool.query(`select * from categories`,
            (err, result) => {
                req.categories = result.rows;
                next();
            })
    },
    selectCustomer : function (req, res, next) {
        pool.query(`select * from customers where username = $1`, [req.session.customer],
            (err, result) => {
                req.customer = result.rows;
                next();
            })
    },
    updateCustomer : function (req, res, next) {
        if(req.body.firstname.length === 0  || req.body.username.length === 0 || req.body.lastname.length === 0 ||
            req.body.email.length === 0) {
            alert = 'Fill out all the form fields!';
            res.redirect('/customers/customerPage');
        }
        else {
            pool.query(`select * from customers where email = $1 and username != $2`, [req.body.email, req.session.customer],
                (err, result) => {
                    if (result.rows.length !== 0) {
                        alert = 'Email already exists!';
                        res.redirect('/customers/customerPage');
                    }
                    else if (result.rows.length === 0) {
                        pool.query( `select * from customers where username = $1 and username != $2`, [req.body.username, req.session.customer],
                            (err, result) => {
                                if (result.rows.length !== 0) {
                                    alert = 'Username already exists!';
                                    res.redirect('/customers/customerPage');
                                } else if (result.rows.length === 0) {
                                    pool.query(`update customers set first_name = $1, last_name = $2, email = $3, username = $4
                                                where customer_id = $5 `,
                                        [req.body.firstname, req.body.lastname, req.body.email, req.body.username, req.session.customer_id],
                                        (err, result) => {
                                            req.session.customer = req.body.username;
                                            alert = undefined
                                            res.redirect('/customers/customerPage');
                                        }
                                    )
                                }
                            });
                    }
                })
        }
    },
    changeProfilePhoto : function (req, res, next) {
        pool.query( `update customers set profile_photo = $1 where username = $2`, [req.file.filename, req.session.customer],
            (err, result) => {
                res.redirect('/customers/customerPage');
            })
    },
    changePassword :  function (req, res, next) {
        if (req.body.password.length === 0) {
            alert = 'Password can not be empty!';
            res.redirect('/customers/customerPage');
        }
        else {
            pool.query(`update customers set password = $1 where username = $2`, [bcrypt.hashSync(req.body.password, 10), req.session.customer],
                (err, result) => {
                    res.redirect('/customers/logout');
                })
        }
    },
    changeInterests : function (req, res, next) {
        if (req.body.interest.length === 0) {
            alert = 'Interest can not be empty!';
            res.redirect('/customers/customerPage');
        }
        else {
            pool.query(`update customers set interests = $1 where username = $2`, [req.body.interest, req.session.customer],
                (err, result) => {
                    alert = "Interests changed!";
                    res.redirect('/customers/customerPage');
                })
        }
    },
    searchProduct : function (req, res, next) {
        pool.query(`select * from products p inner join shopinformations s on s.shop_id = p.shop_id where product_name like '%' || $1 || '%'`,
            [req.body.searchProduct],
            (err, result) => {
                req.products = result.rows;
                next();
        });
    },
    searchShop : function (req, res, next) {
        pool.query(`select * from shopinformations where shopname like '%' || $1 || '%' and status = 'active'`,
            [req.body.searchShop],
            (err, result) => {
                req.shops = result.rows;
                next();
            });
    },
    interestsRecommend : function (req, res, next) {
        pool.query(`select * from products p inner join categories c on c.id = p.category
               inner join shopinformations s on s.shop_id = p.shop_id
               where categoryname in ($1, $2) limit 8`,
            [req.session.interests[0], req.session.interests[2]],
            (err, result) => {
                req.interest = result.rows;
                next();
            })
    },
    randomRecommend : function (req, res, next) {
        pool.query(`select * from products p inner join shopinformations s on s.shop_id = p.shop_id limit 8`,
            (err, result) => {
                req.randomProducts = result.rows;
                next();
            })
    },
    productInfo: function (req, res, next) {
        pool.query(`select * from products inner join shopinformations s on s.shop_id = products.shop_id where product_id = $1`,
            [req.params.product],
            (err, result) => {
                req.product = result.rows;
                next();
            })
    },
    rateProduct : function (req, res, next) {
        pool.query(`insert into rates_product (product_id, shop_id, rate) values ($1, $2, $3) `,
            [req.params.product, req.params.shop, req.params.rate],
            (err, result) => {
                next();
            })
    },
    selectShop: function (req, res, next) {
        pool.query(`select categoryname, * from shopinformations inner join categories c on c.id = shopinformations.category_id 
        inner join products p on shopinformations.shop_id = p.shop_id where shopname = $1 limit 3`,
            [req.params.shop],
            (err, result) => {
                req.shop = result.rows;
                next();
            })
    },
    rateShop : function (req, res, next) {
        pool.query(`insert into rates_shop (shop_id, rate) values ($1, $2) `,
            [req.params.shop, req.params.rate],
            (err, result) => {
                next();
            })
    },
    selectShopsProducts : function (req, res, next) {
        pool.query(`select * from products as p inner join shopinformations s on s.shop_id = p.shop_id 
                    where s.shopname = $1`, [req.params.shop],
            (err, result) => {
                req.products = result.rows;
                next();
            });
    },
    addToCart : function (req, res, next){
        pool.query(`insert into cart(product_id, shop_id) values ($1, $2)`, [req.params.product, req.params.shop],
            (err, result) => {
                cartmsg = 'Item added to cart!'
                next();
            })
    },
    selectCart: function (req, res, next){
        pool.query(`select  p.product_name, p.price, s.shopname, s.shop_id from cart c 
                inner join products p on p.product_id = c.product_id
                inner join shopinformations s on c.shop_id = s.shop_id`,
            (err, result) => {
                req.cart = result.rows;
                next();
            })
    },
    orderNow : async function (req, res, next){
        await pool.query(`insert into orders(shop_id, customer_id) values ($1, $2)`, [req.params.shop, req.params.customer],
             async (err, result) => {
              await  pool.query(`select order_id from orders order by order_id desc limit 1`,
                   async (err, result) => {
                        req.order = result.rows;
                       await pool.query(`select product_id from cart`,
                           async (err, result) => {
                            req.products = result.rows;
                            let Length = 0;
                            while(Length !== req.products.length) {
                                await pool.query(`insert into order_detail(order_id, product_id) values ($1, $2)`,
                                    [req.order[0].order_id, req.products[Length].product_id],
                                    (err, result) => {} )
                                Length = Length + 1;
                            }
                       })
                       pool.query(`delete from cart`,
                           (err, result) => {
                               next();
                           })
                    })
            })
    },
    deleteCart : function (req, res, next) {
        pool.query(`delete from cart`,
            (err, result) => {
                next();
            })
    },
    cancel : function (req, res, next) {
        pool.query(`delete from orders where order_id = $1`, [req.params.order_id],
            (err, result) => {
                next();
            })
    },
    selectCustomersOrder : function (req, res, next) {
        pool.query(`select * from orders 
                    inner join order_detail od on orders.order_id = od.order_id 
                    inner join products p on od.product_id = p.product_id
                    where customer_id = $1 and order_status != 'accepted' `,
            [req.session.customer_id],
            (err, result) => {
                req.orders = result.rows;
                next();
            })
    },
    sendEmail : function (req, res, next) {
        pool.query(`select email from customers where customer_id = $1`, [req.session.customer_id],
            (err, result) => {
                let mailOptions = {
                    from: 'ouvrierwebshopa@gmail.com',
                    to: result.rows[0].email,
                    subject: "Web shop order",
                    text: "Your order has been successfully created!",
                };
                sendMail.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log("Email sent!" + info.response);
                    }
                });
                next();
            });
    },
    categoryFilter : function (req, res, next) {
        pool.query(`select * from products p inner join categories c on c.id = p.category where categoryname = $1`,
            [req.body.category],
            (err, result) => {
                req.categoryProducts = result.rows;
                next();
            })
    },
    sortProducts : function (req, res, next) {
            if (req.body.sort === 'price') {
                pool.query(`select p.product_name, p.product_id, p.product_desc,p.price, p.unit, p.photo_path, s.shopname from products p
                        inner join shopinformations s on s.shop_id = p.shop_id
                        order by p.price`,
                    (err, result) => {
                        req.sortedProducts = result.rows;
                        next();
                    })
            } else {
                pool.query(`select p.product_name, p.product_id, p.product_desc,p.price, p.unit, p.photo_path, s.shopname from products p
                        inner join shopinformations s on s.shop_id = p.shop_id
                        order by p.product_name`,
                    (err, result) => {
                        req.sortedProducts = result.rows;
                        next();
                    })
            }
        },
    selectMessagesWithAdmin : function (req, res, next) {
        pool.query(`select message, code_from, code_to from chat where sender_id = $1 and code_from = $2 and code_to = $3 or
                    receiver_id = $1 and code_from = $4 and code_to = $5
                    order by time desc`,
            [req.session.customer_id, customer, admin, admin, customer],
            (err, result) => {
                req.MessagesWithAdmin = result.rows;
                next();
            })
    },
    selectMerchantsChats : function (req, res, next) {
        pool.query(`select distinct s.shop_id, s.shopname, s.profilepicture_path from chat
                   inner join shopinformations s on shop_id = sender_id
                    where code_to = $1 and code_from = $2`, [customer, merchant],
            (err, result) => {
                req.MerchantsChats = result.rows;
                next();
            })
    },
    selectMessagesWithMerchants : function (req, res, next) {
        pool.query(`select message, code_from, code_to, time from chat
                    where sender_id = $1 and code_from = $2
                     and code_to = $3 or receiver_id = $1 and code_from = $4 and code_to = $5
                   order by time desc`,
            [req.params.id, merchant, customer, customer, merchant],
            (err, result) => {
                req.session.shop_id = req.params.id;
                req.MessagesWithMerchant = result.rows;
                next();
            })
    },
    searchMerchantChats : function (req, res, next){
        pool.query(`select s.shop_id, s.shopname, s.profilepicture_path from shopinformations s
                    where shopname like '%' || $1 ||'%'`, [req.body.shop],
            (err, result) => {
                req.MerchantsChats = result.rows;
                console.info(req.merchantsChats)
                res.render('Customers/merchantsChat', {title: 'Chat', user: req.session.merchant, merchantsChats: req.MerchantsChats})
            })
    },
}

router.get('/', function (req, res, next){
    res.render('Customers/customerLogin', {title: 'Log in'});
})
router.get('/indexCustomer',
    authCustomer,
    dataBaseObject.selectCustomer,
    dataBaseObject.interestsRecommend,
    dataBaseObject.randomRecommend,
    dataBaseObject.selectCategories,
    function (req, res, next){
    res.render('Customers/indexCustomer', {title: 'Home', user: req.session.customer, customer: req.customer, interests: req.interest,
        randomProducts: req.randomProducts, categories: req.categories});
})
/* Customer registration */
router.get('/customerRegister',
    dataBaseObject.selectCategories,
    function (req, res, next){
    res.render('Customers/customersRegister', {title: 'Registration', categories: req.categories, alert: alert} );
})
router.post('/registration',
    upload.single('profilePicture'),
    dataBaseObject.insertCustomer,
    function(req, res, next) {
})

/* Customer log in */
router.get('/customerLogin', function (req, res, next){
    res.render('Customers/customerLogin', {title: 'Log in'});
})
router.post('/login',
    dataBaseObject.logInCustomer,
    function (req, res, next){
    res.sendStatus(200);
})

// Customer authorization
router.get('/customerPage',
    authCustomer,
    dataBaseObject.selectCustomer,
    dataBaseObject.selectCategories,
    function (req, res, next) {
        res.render('Customers/customersPage', {title: 'Customers', user: req.session.customer, customer: req.customer, alert: alert, categories: req.categories});
})
router.post('/updateCustomer',
    authCustomer,
    dataBaseObject.updateCustomer,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/changeProfilePhoto',
    upload.single('newProfilePhoto'),
    dataBaseObject.changeProfilePhoto,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/changePassword',
    dataBaseObject.changePassword,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/changeInterests',
    dataBaseObject.changeInterests,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/searchProduct',
    dataBaseObject.searchProduct,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/SearchProducts', {title: 'Search results', user: req.session.customer, products: req.products, customer: req.customer })
})
router.post('/searchShop',
    dataBaseObject.searchShop,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/SearchShops', {title: 'Search results', user: req.session.customer, shops: req.shops, customer: req.customer})
})
router.get('/product/:product',
    authCustomer,
    dataBaseObject.productInfo,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/product', {title: 'Product', user: req.session.customer, product: req.product, customer: req.customer})
})
router.post('/rateProduct/:product/:shop/:rate',
    dataBaseObject.rateProduct,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/rateShop/:shop/:rate',
    dataBaseObject.rateShop,
    function (req, res, next) {
        res.sendStatus(200);
    })
router.get('/shop/:shop',
    authCustomer,
    dataBaseObject.selectShop,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/shop', {title: 'Shop', user: req.session.customer, shop: req.shop, customer: req.customer})
})
router.post('/addToCart/:product/:shop',
    dataBaseObject.addToCart,
    function (req, res, next) {
        res.sendStatus(200);
})
router.get('/cart',
    authCustomer,
    dataBaseObject.selectCustomer,
    dataBaseObject.selectCart,
    function (req, res, next){
    res.render('Customers/cart', {title: 'Cart', user: req.session.customer, customer: req.customer, cart: req.cart })
})
router.post('/order/:shop/:customer',
    dataBaseObject.orderNow,
    dataBaseObject.sendEmail,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/deleteCart',
    dataBaseObject.deleteCart,
    function (req, res, next) {
    res.sendStatus(200);
})
router.get('/productsCatalog/:shop',
    authCustomer,
    dataBaseObject.selectShop,
    dataBaseObject.selectShopsProducts,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/productsCatalog', { title: 'Products Catalog', user: req.session.customer, products: req.products, shop: req.shop, customer: req.customer})
    })
router.get('/orders',
    authCustomer,
    dataBaseObject.selectCustomersOrder,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/orders', {title: 'My orders', user: req.session.customer, customer: req.customer, orders: req.orders})
})
router.post('/cancel/:order_id',
    dataBaseObject.cancel,
    function (req, res, next) {
    res.sendStatus(200);
})
router.post('/categoryFilter',
    dataBaseObject.categoryFilter,
    dataBaseObject.selectCategories,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/categoryFilter',  {title: 'Products', user: req.session.customer, categoryFilter: req.categoryProducts,
            categories: req.categories, customer: req.customer})
})
router.post('/sort',
    dataBaseObject.sortProducts,
    dataBaseObject.selectCategories,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/sortFilter',  {title: 'Products', user: req.session.customer, sortedProducts: req.sortedProducts,
            categories: req.categories, customer: req.customer})
    })
router.get('/adminChat',
    authCustomer,
    dataBaseObject.selectCustomer,
    dataBaseObject.selectMessagesWithAdmin,
    function (req, res, next) {
        res.render('Customers/adminChat', {title: 'Chat', user: req.session.customer, customer: req.customer, messages: req.MessagesWithAdmin})
})
router.get('/merchantsChat/',
    authCustomer,
    dataBaseObject.selectMerchantsChats,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/merchantsChat', {title: 'Chat', user: req.session.merchant, customer: req.customer,
            merchantsChats: req.MerchantsChats})
    })
router.get('/merchantsChat/:id',
    authCustomer,
    dataBaseObject.selectMessagesWithMerchants,
    dataBaseObject.selectCustomer,
    function (req, res, next) {
        res.render('Customers/customer_merchant', {title: 'Chat', user: req.session.merchant, customer: req.customer,
            messages: req.MessagesWithMerchant, shop: req.session.shop_id })
})
router.post('/searchShopChat',
    dataBaseObject.searchMerchantChats,
    function (req, res, next) {
        res.sendStatus(200);
    })
// Log out
router.post('/logout', function (req, res, next){
    req.session.destroy(err => {
        res.redirect('/customers/customerLogin')
    })
})
router.get('/logout', function (req, res, next){
    req.session.destroy(err => {
        res.redirect('/customers/customerLogin')
    })
})

module.exports = router;
