var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const session = require("express-session");
const { authAdmin, authMerchant} = require('./Authorizations');
const { authAdminM } = require('./Authorizations');
const {  authAdminC } = require('./Authorizations');


//Connecting to the ElephantSQL DataBase
const { Pool, Client } = require('pg')
const {route} = require("express/lib/router");
const pool = new Pool({
    user: 'uijvqpvp',
    host: 'ella.db.elephantsql.com',
    database: 'uijvqpvp',
    password: 'TQNc3M530lNpfFl6aj3O1LUH1KYpkrbK',
    port: 5432,
    max: 10,
    idleTimeoutMillis: 3000
})

let alert = undefined;
var admin = 0, customer = 1, merchant = 2;

var dataBaseObject = {
    adminAuthentication : function (req, res, next) {
        pool.query('select * from administrator where username = $1 ',
            [req.body.username],
            (err, result) => {
            if (result.rows.length === 0) {
                alert = 'Incorrect username or password!'
                res.redirect('/adminLogin');
            }
            else if(req.body.password.length === 0 || req.body.username.length === 0)
            {
                alert = 'Please fill out all the form fields!'
                res.redirect('/adminLogin');
            }
            else if(result.rows[0].username === req.body.username  && !bcrypt.compareSync(req.body.password, result.rows[0].password)) {
                alert = "Wrong password!"
                res.redirect('/adminLogin');
            }
            else if(result.rows[0].username === req.body.username &&
                bcrypt.compareSync(req.body.password, result.rows[0].password))  {
                    alert = undefined;
                    req.session.admin = req.body.username;
                    res.redirect('/adminLogin/adminPage');
            }
        })
    },
    countCustomers: function (req, res, next) {
        pool.query(`select count(username) from customers`,
            (err, result) => {
                req.customers = result.rows[0].count;
                next();
            }
        )

    },
    countShops: function (req, res, next) {
        pool.query(`select count(shopname) from shopinformations`,
            (err, result) => {
                req.shops = result.rows[0].count;
                next();
            }
        )
    },
    countProducts: function (req, res, next) {
        pool.query(`select count(product_id) from products inner join shopinformations s on s.shop_id = products.shop_id;`,
            (err, result) => {
                req.products = result.rows[0].count;
                next();
            }
        )
    },
    countOrders : function (req, res, next) {
        pool.query(`select count(order_id) from orders`,
            (err, result) => {
                req.orders = result.rows[0].count;
                next();
            }
        )
    },
    selectActiveCustomers: function (req, res, next) {
        pool.query(`select * from customers where status = 'active'`,
            (err, result) => {
                req.ActiveCustomers = result.rows;
                next();
            }
        )

    },
    selectBlockedCustomers: function (req, res, next) {
        pool.query(`select * from customers where status = 'blocked'`,
            (err, result) => {
                req.BLockedCustomers = result.rows;
                next();
            }
        )

    },
    selectActiveMerchants: function (req, res, next) {
        pool.query(`select * from shopinformations where status = 'active'`,
            (err, result) => {
                req.ActiveMerchants = result.rows;
                next();
            }
        )
    },
    selectBlockedMerchants: function (req, res, next) {
        pool.query(`select * from shopinformations where status = 'blocked'`,
            (err, result) => {
                req.BlockedMerchants = result.rows;
                next();
            }
        )
    },
    blockCustomer: function (req, res, next) {
        pool.query(`update customers set status = 'blocked' where username = $1`, [req.params.customer],
            (err, result) => {
                next();
            }
        )
    },
    unblockCustomer: function (req, res, next) {
        pool.query(`update customers set status = 'active' where username = $1`, [req.params.customer],
            (err, result) => {
                next();
            }
        )
    },
    blockMerchant: function (req, res, next) {
        pool.query(`update shopinformations set status = 'blocked' where shopname = $1`, [req.params.shop],
            (err, result) => {
                next();
            }
        )
    },
    unblockMerchant: function (req, res, next) {
        pool.query(`update shopinformations set status = 'active' where shopname = $1`, [req.params.shop],
            (err, result) => {
                next();
            }
        )
    },
    archiveCustomer: function (req, res, next) {
        pool.query(`update shopinformations set status = 'archived' where username = $1`, [req.params.customer],
            (err, result) => {
                next();
            }
        )
    },
    archiveMerchant: function (req, res, next) {
        pool.query(`update shopinformations set status = 'archived' where shopname = $1`, [req.params.shop],
            (err, result) => {
                next();
            }
        )
    },
    searchShop : function (req, res, next) {
        pool.query(`select * from shopinformations where shopname like '%' || $1 || '%' and status = 'active'`,
            [req.body.searchShop],
            (err, result) => {
                req.shops = result.rows;
                next();
            });
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
    productInfo: function (req, res, next) {
        pool.query(`select * from products inner join shopinformations s on s.shop_id = products.shop_id where product_id = $1`,
            [req.params.product],
            (err, result) => {
                req.product = result.rows;
                console.info(req.product);
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
    selectMessagesWithCustomers : function (req, res, next) {
        pool.query(`select message, code_from, code_to, time from chat
                    where sender_id = $1 and code_from = $2
                     and code_to = $3 or receiver_id = $1 and code_from = $4 and code_to = $5
                   order by time desc`,
            [req.params.id, customer, admin, admin, customer],
            (err, result) => {
                req.session.customer_id = req.params.id;
                req.MessagesWithAdmin = result.rows;
                next();
            })
    },
    selectCustomersChats : function (req, res, next) {
        pool.query(`select distinct c.customer_id, c.first_name, c.last_name, c.profile_photo from chat
                   inner join customers c on customer_id = sender_id
                    where code_to = $1 `, [admin],
            (err, result) => {
                req.CustomersChats = result.rows;
                next();
            })
    },
    selectMerchantsChats : function (req, res, next) {
        pool.query(`select distinct s.shop_id, s.shopname, s.profilepicture_path from chat
                   inner join shopinformations s on shop_id = sender_id
                    where code_to = $1 and code_from = $2 `, [admin, merchant],
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
            [req.params.id, merchant, admin, admin, merchant],
            (err, result) => {
                req.session.merchant_id = req.params.id;
                req.MessagesWithAdmin = result.rows;
                next();
            })
    },
    searchMerchantChats : function (req, res, next){
        pool.query(`select s.shop_id, s.shopname, s.profilepicture_path from shopinformations s
                    where shopname like '%' || $1 ||'%'`, [req.body.shop],
                (err, result) => {
                    req.merchantsChats = result.rows;
                    res.render('Admin/merchantsChat', {title: 'Chat', user: req.session.admin, merchantsChats: req.merchantsChats})
                })
    },
    searchCustomersChats : function (req, res, next){
        pool.query(`select c.customer_id, c.first_name, c.last_name, c.profile_photo from customers c
                    where c.username like '%' || $1 ||'%'`, [req.body.customer],
            (err, result) => {
                req.CustomersChats = result.rows;
                res.render('Admin/customersChat', {title: 'Chat', user: req.session.admin, customersChats: req.CustomersChats})
            })
    },
}

/* Admin log in form */
router.get('/', function(req, res, next) {
    res.render('Admin/adminLogin', { title: 'Admin', alert: alert});
});

//Home page for Admin
router.get('/adminPage',
    dataBaseObject.countCustomers,
    dataBaseObject.countShops,
    dataBaseObject.countProducts,
    dataBaseObject.countOrders,
    authAdmin,
    function (req, res, next) {
        res.render('Admin/adminPage', { title: 'Admin', user: req.session.admin, cust: req.customers, shops: req.shops, products: req.products, orders: req.orders});
})

// Get login values from form
router.post('/login',
    dataBaseObject.adminAuthentication,
    function (req, res, next){
    req.admin = req.body.username;
})

// Deny access
router.get('/restrictAdminPage',
    function (req, res, next){
        res.render('Admin/restrictAdminPage', {title: "Not allowed"});
})

// Edit merchants
router.get('/adminMerchants',
    authAdminM,
    dataBaseObject.selectActiveMerchants,
    dataBaseObject.selectBlockedMerchants,
    function (req, res, next){
        res.render('Admin/adminMerch', {title: 'EditMerchants', activeMerchants: req.ActiveMerchants, blockedMerchants: req.BlockedMerchants,
            user:req.session.admin})
})

// Edit customers
router.get('/adminCustomers',
    authAdminC,
    dataBaseObject.selectActiveCustomers,
    dataBaseObject.selectBlockedCustomers,
    function (req, res, next){
        res.render('Admin/adminCustomers', {title: 'EditCustomers', activeCustomers: req.ActiveCustomers, blockedCustomers: req.BLockedCustomers,
            user:req.session.admin})
})

router.get('/indexAdmin',
    authAdmin,
    function (req, res, next) {
    res.render('Admin/indexAdmin', { title: 'Admin', user:req.session.admin })
})
router.post('/block/:customer',
    dataBaseObject.blockCustomer,
    function (req, res, next) {
        res.sendStatus(200);
    }
)
router.post('/unblock/:customer',
    dataBaseObject.unblockCustomer,
    function (req, res, next) {
        res.sendStatus(200);
    })
router.post('/merchantBlock/:shop',
    dataBaseObject.blockMerchant,
    function (req, res, next) {
    res.sendStatus(200);
})
router.post('/merchantUnblock/:shop',
    dataBaseObject.unblockMerchant,
    function (req, res, next) {
        res.sendStatus(200);
})

router.post('/archiveCustomer/:customer',
    dataBaseObject.archiveCustomer,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/archiveMerchant/:shop',
    dataBaseObject.archiveMerchant,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/searchShop',
    dataBaseObject.searchShop,
    function (req, res, next) {
        res.render('Admin/SearchShops', {title: 'Search results', user: req.session.admin, shops: req.shops})
})
router.get('/product/:product',
    authAdmin,
    dataBaseObject.productInfo,
    function (req, res, next) {
        res.render('Admin/product', {title: 'Product', user: req.session.admin, product: req.product})
})
router.get('/shop/:shop',
    authAdmin,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Admin/shop', {title: 'Shop', user: req.session.admin, shop: req.shop})
})
router.get('/productsCatalog/:shop',
    authAdmin,
    dataBaseObject.selectShopsProducts,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Admin/productsCatalog', { title: 'Products Catalog', user: req.session.admin, products: req.products, shop: req.shop})
})
router.get('/customersChat/',
    authAdmin,
    dataBaseObject.selectCustomersChats,
    function (req, res, next) {
        res.render('Admin/customersChat', {title: 'Chat', user: req.session.admin,  customersChats: req.CustomersChats})
 })
router.get('/customersChat/:id',
    authAdmin,
    dataBaseObject.selectMessagesWithCustomers,
    function (req, res, next) {
        res.render('Admin/chat', {title: 'Chat', user: req.session.admin,  customersChats: req.CustomersChats, messages: req.MessagesWithAdmin,
        customer: req.session.customer_id})
    })
router.get('/merchantsChat/',
    authAdmin,
    dataBaseObject.selectMerchantsChats,
    function (req, res, next) {
        res.render('Admin/merchantsChat', {title: 'Chat', user: req.session.admin,  merchantsChats: req.MerchantsChats})
    })
router.get('/merchantsChat/:id',
    authAdmin,
    dataBaseObject.selectMessagesWithMerchants,
    function (req, res, next) {
        res.render('Admin/chatMerchant', {title: 'Chat', user: req.session.admin, messages: req.MessagesWithAdmin,
            merchant: req.session.merchant_id})
})
router.post('/searchShopChat',
    dataBaseObject.searchMerchantChats,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/searchCustomerChat',
    dataBaseObject.searchCustomersChats,
    function (req, res, next) {
        res.sendStatus(200);
})
// Log out
router.post('/logout', function (req, res, next){
    req.session.destroy(err => {
        res.redirect('/adminLogin')
    })
})
module.exports = router;
