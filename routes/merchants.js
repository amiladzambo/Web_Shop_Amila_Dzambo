var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const session = require("express-session");
var path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');


const { authMerchant } = require('./Authorizations');
const sendMail = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: 'ouvrierwebshop@gmail.com', // generated ethereal user
        pass: '2846webshop', // generated ethereal password
    }, tls: {
        rejectUnauthorized: false
    }
})
const storage = multer.diskStorage({
    destination: './public/images/products',
    filename: function (req, file, cb) {
        cb(null, req.session.merchant + '-' + Date.now() + path.extname(file.originalname));
    }
});
const profileImageStorage = multer.diskStorage({
    destination: './public/images/Profile_pictures',
    filename: function (req, file, cb) {
        cb(null, req.body.shopname + '-' + Date.now() + path.extname(file.originalname));
    }
})
const coverImageStorage = multer.diskStorage({
    destination: './public/images/Cover_pictures',
    filename: function (req, file, cb) {
        cb(null, req.session.merchant + '-' + Date.now() + path.extname(file.originalname));
    }
})
const upload = multer({
    storage: storage
})
const uploadProfile = multer({
    storage : profileImageStorage
})
const uploadCover = multer({
    storage : coverImageStorage
})


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

let cat, shop;
let alert = undefined;
let msg = undefined;
let cover = "exists";
let admin = 0, customer = 1, merchant = 2;

var dataBaseObject = {
    selectCategories : function (req, res, next) {
        pool.query(`select * from categories`,
            (err, result) => {
                req.categories = result.rows;
                next();
            })
    },
    findCategory : function (req, res, next) {
        pool.query(`select * from categories where categoryname = $1`, [req.body.category],
            (err, result) => {
                cat = result.rows[0].id;
                next();
            }
        )
    },
    findShop : function (req, res, next) {
        pool.query(`select shop_id from shopinformations where shopname = $1`, [req.session.merchant],
            (err, result) => {
                shop = result.rows[0].shop_id;
                next();
            }
        )
    },
    insertMerchant: function (req, res, next) {
        if (req.body.shopname.length === 0 || req.body.password.length === 0 || req.body.phone.length === 0
            || req.body.email.length === 0 || req.body.head_address.length === 0 || req.body.branch_address.length === 0 ||
            req.body.category.length === 0 || req.body.firstname.length === 0 || req.body.lastname.length === 0) {
            alert = 'Please fill out all of the form fields!';
            res.redirect('/merchants/merchantRegister');
        }
        else {
            pool.query(`select * from shopinformations where email = $1`, [req.body.email],
                (err, result) => {
                    if (result.rows.length === 0) {
                        pool.query(`select * from shopinformations where shopname = $1`, [req.body.shopname],
                            (err, result) => {
                                if (result.rows.length !== 0) {
                                    alert = 'Shop with that name already exists!';
                                    res.redirect('/merchants/merchantRegister');
                                } else if (result.rows.length === 0) {
                                    pool.query(`insert into shopinformations (firstname, lastname, shopname, password, category_id, headquaters_address,
                                        branchoffice_address, email, telephone,  profilepicture_path) values 
                                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                                        [req.body.firstname, req.body.lastname, req.body.shopname, bcrypt.hashSync(req.body.password, 10),
                                            cat, req.body.head_address, req.body.branch_address, req.body.email, req.body.phone, req.file.filename],
                                        (err, result) => {
                                            req.session.merchant = req.body.shopname;
                                            cover = undefined;
                                            res.redirect('/merchants/merchantPage');
                                        })
                                }
                            });
                    }
                    else if (result.rows[0].length !== 0) {
                        alert = 'Shop with that email already exists!'
                        res.redirect('/merchants/merchantRegister');
                    }
                })
        }
    },
    logInMerchant : function (req, res, next) {
        if (req.body.shopname.length === 0 || req.body.password.length === 0) {
            alert = 'Please fill out all of the form fields.'
            cover = "exists";
            res.redirect('/merchants/merchantLogin');
        }
        else {
            pool.query(`select * from shopinformations where shopname = $1`, [req.body.shopname],
                (err, result) => {
                    if (result.rows.length === 0) {
                        alert = 'Shop with that name does not exists.'
                        res.redirect('/merchants/merchantLogin');
                    }
                    else if(result.rows[0].shopname === req.body.shopname &&
                        !bcrypt.compareSync(req.body.password, result.rows[0].password)) {
                        alert = 'Wrong password';
                        res.redirect('/merchants/merchantLogin');
                    }
                    else if(result.rows[0].status === 'blocked') {
                        alert = 'Your profile has been blocked by the admin!'
                        res.redirect('/merchants/merchantLogin');
                    }
                    else if(result.rows[0].status === 'archived') {
                        alert = 'Your profile has been permanently deleted by the admin!'
                        res.redirect('/merchants/merchantLogin');
                    }
                    else if (result.rows[0].shopname === req.body.shopname &&
                        bcrypt.compareSync(req.body.password, result.rows[0].password)) {
                        req.session.merchant = req.body.shopname;
                        req.session.shop_id = result.rows[0].shop_id;
                        alert = undefined;
                        res.redirect('/merchants/merchantPage');
                    }
                })
        }
    },
    selectShop : function (req, res, next) {
        pool.query(`select * from shopinformations where shopname = $1`, [req.session.merchant],
            (err, result) => {
                req.shop = result.rows;
                next();
            });
    },
    addProduct : function (req, res, next) {
        allPhotos  = [];
        for(let i = 0; i < req.files.length; i++) {
                allPhotos.push(req.files[i].filename)
        }
        pool.query( `insert into products(product_name, product_desc, shop_id, category, price, unit, photo_path) values ($1, $2, $3, $4, $5, $6, $7)`,
                [req.body.productname, req.body.productdesc, shop, cat , req.body.productprice, req.body.productunits, allPhotos],
            (err, result) => {
                next();
            })
    },
    updateShop : function (req, res, next) {
        if (req.body.shopname.length === 0 || req.body.phone.length === 0
            || req.body.email.length === 0 || req.body.head_address.length === 0 || req.body.firstname.length === 0 ||
            req.body.lastname.length === 0) {
            alert = 'Chosen field can not be empty!';
            res.redirect('/merchants/merchantPage');
        }
        else {
            pool.query(`select * from shopinformations where email = $1 and shopname != $2`, [req.body.email, req.session.merchant],
                (err, result) => {
                    if (result.rows.length === 0) {
                        pool.query(`select * from shopinformations where shopname = $1 and shopname != $2`, [req.body.shopname, req.session.merchant],
                            (err, result) => {
                                if (result.rows.length !== 0) {
                                    alert = 'Shop with that name already exists!';
                                    res.redirect('/merchants/merchantPage');
                                } else if (result.rows.length === 0) {
                                    pool.query(`update shopinformations set firstname = $1, lastname = $2, shopname = $3, headquaters_address = $4, 
                                        branchoffice_address = $5, email = $6, telephone = $7 where shopname = $8`,
                                        [req.body.firstname, req.body.lastname, req.body.shopname, req.body.head_address, req.body.branch_address,
                                            req.body.email, req.body.phone, req.session.merchant],
                                        (err, result) => {
                                            req.session.merchant = req.body.shopname;
                                            alert = undefined;
                                            res.redirect('/merchants/merchantPage');
                                        })
                                }
                            });
                    }
                    else if (result.rows[0].length !== 0) {
                        alert = 'Shop with that email already exists!'
                        res.redirect('/merchants/merchantPage');
                    }
                })
        }
    },
    changePassword : function (req, res, next) {
        if (req.body.password.length === 0) {
            alert = 'Password can not be empty!';
            res.redirect('/merchants/merchantPage');
        }
        else {
        pool.query(`update shopinformations set password = $1 where shopname = $2`, [bcrypt.hashSync(req.body.password, 10), req.session.merchant],
            (err, result) => {
                res.redirect('/merchants/logout');
            })
        }
    },
    selectShopsProducts : function (req, res, next) {
        pool.query(`select * from products as p inner join shopinformations s on s.shop_id = p.shop_id 
                    where s.shopname = $1`, [req.session.merchant],
            (err, result) => {
                req.products = result.rows;
                next();
            });
    },
    editProduct : function (req, res, next) {
        pool.query(`select * from products as p  inner join categories c on c.id = p.category where p.product_id = $1`, [req.params.product],
            (err, result) => {
                req.product = result.rows;
                next();
            });
    },
    updateProduct : function (req, res, next) {
        pool.query( `update products set product_name = $1, price = $2, product_desc = $3, unit = $4 where product_id = $5`,
            [req.body.productname, req.body.productprice, req.body.productdescription, req.body.productunits, req.body.product_id],
            (err, result) => {
                next();
            })
    },
    deleteProduct : function (req, res, next) {
        pool.query(`delete from products where product_id = $1`, [req.params.product],
            (err, result) => {
                next();
        });
    },
    changeProfilePhoto : function (req, res, next) {
        pool.query( `update shopinformations set profilepicture_path = $1 where shopname = $2`, [req.file.filename, req.session.merchant],
            (err, result) => {
                res.redirect('/merchants/merchantPage');
            })
    },
    changeCoverPhoto : function (req, res, next) {
        pool.query( `update shopinformations set coverimage_path = $1 where shopname = $2`, [req.file.filename, req.session.merchant],
            (err, result) => {
                cover = "exists";
                res.redirect('/merchants/merchantPage');
            })
    },
    sendEmail : function (req, res, next) {
            pool.query(`select email from  customers inner join orders o on customers.customer_id = o.customer_id where order_id = $1`,
                [req.params.order_id],
                (err, result) => {
                    let mailOptions = {
                        from: 'ouvrierwebshop@gmail.com',
                        to: result.rows[0].email,
                        subject: "Web shop order!", // Subject line
                        text: "Your order has been succesfully delivered!",
                    };
                    sendMail.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log("Email je poslan" + info.response);
                        }
                    });
                    res.send("0");
            });
    },
    searchProduct : function (req, res, next) {
        pool.query(`select * from products p inner join shopinformations s on s.shop_id = p.shop_id where product_name like '%' || $1 || '%'
                    and s.shop_id = $2`,
            [req.body.searchProduct, req.session.shop_id],
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
    selectOrders: function (req, res, next) {
            pool.query(`select * from  order_detail od
            inner join orders o on od.order_id = o.order_id
            inner join customers c on c.customer_id = o.customer_id
            inner join shopinformations s on s.shop_id = o.shop_id
            inner join products p on od.product_id = p.product_id
            where s.shop_id = $1`, [req.session.shop_id],
            (err, result) => {
                req.Orders = result.rows;
                next();
            }
        )
    },
    selectPendingOrders: async function (req, res, next) {
       await pool.query(`select * from  order_detail od
                    inner join orders o on od.order_id = o.order_id
                    inner join customers c on c.customer_id = o.customer_id
                    inner join shopinformations s on s.shop_id = o.shop_id
                   inner join products p on od.product_id = p.product_id
                    where order_status = 'pending' and s.shop_id = $1`, [req.session.shop_id],
            (err, result) => {
                req.pendingOrders = result.rows;
                next();
            }
        )
    },
    selectAcceptedOrders : function (req, res, next) {
        pool.query(`select * from  order_detail od
                     inner join orders o on od.order_id = o.order_id
                    inner join customers c on c.customer_id = o.customer_id
                    inner join shopinformations s on s.shop_id = o.shop_id
                     inner join products p on od.product_id = p.product_id
                    where order_status = 'accepted' and s.shop_id = $1`, [req.session.shop_id],
            (err, result) => {
                req.acceptedOrders = result.rows;
                next();
            })
    },
    acceptOrder : function (req, res, next) {
        pool.query(`update orders set order_status = 'accepted' where shop_id = $1 and order_id = $2`, [req.session.shop_id, req.params.order_id],
            (err, result) => {
                next();
        })
    },
    declineOrder : function (req, res, next) {
        pool.query(`update orders set order_status = 'declined' where shop_id = $1 and order_id = $2`, [req.session.shop_id, req.params.order_id],
            (err, result) => {
                next();
            })
    },
    deliverOrder : function (req, res, next) {
        pool.query(`update orders set order_status = 'delivered' where shop_id = $1 and order_id = $2`, [req.session.shop_id, req.params.order_id],
            (err, result) => {
                next();
            })
    },
    earnings : function (req, res, next) {
        pool.query(`select sum(p.price) from orders
            inner join order_detail od on orders.order_id = od.order_id
            inner join products p on od.product_id = p.product_id
            where p.shop_id = $1 and order_status = 'delivered'`,
            [req.session.shop_id],
            (err, result) => {
                req.earnings  = result.rows[0].sum;
                console.info(req.earnings)
                next();
            })
    },
    categoryFilter : function (req, res, next) {
        pool.query(`select * from products p inner join categories c on c.id = p.category 
                    where categoryname = $1 and shop_id = $2`,
            [req.body.category, req.session.shop_id],
            (err, result) => {
                req.categoryProducts = result.rows;
                next();
            })
    },
    selectMessagesWithAdmin : function (req, res, next) {
        pool.query(`select message, code_from, code_to from chat where sender_id = $1 and code_from = $2 and code_to = $3 or
                    receiver_id = $1 and code_from = $4 and code_to = $5
                    order by time desc`,
            [req.session.shop_id, merchant, admin, admin, merchant],
            (err, result) => {
                req.MessagesWithAdmin = result.rows;
                console.info(req.MessagesWithAdmin);
                next();
            })
    },
    selectCustomersChats : function (req, res, next) {
    pool.query(`select distinct c.customer_id, c.first_name, c.last_name, c.profile_photo from chat
                   inner join customers c on customer_id = sender_id
                    where code_to = $1 and code_from = $2`,
                [merchant, customer],
        (err, result) => {
            req.CustomersChats = result.rows;
            next();
        })
    },
    selectMessagesWithCustomers : function (req, res, next) {
        pool.query(`select message, code_from, code_to, time from chat
                    where sender_id = $1 and code_from = $2
                     and code_to = $3 or receiver_id = $1 and code_from = $4 and code_to = $5
                   order by time desc`,
            [req.params.id, customer, merchant, merchant, customer],
            (err, result) => {
                req.session.customer_id = req.params.id;
                req.MessagesWithCustomer = result.rows;
                next();
            })
    },
    searchCustomersChats : function (req, res, next){
        pool.query(`select c.customer_id, c.first_name, c.last_name, c.profile_photo from customers c
                    where c.username like '%' || $1 ||'%'`, [req.body.customer],
            (err, result) => {
                req.CustomersChats = result.rows;
                res.render('Merchants/customersChat', {title: 'Chat', user: req.session.merchant, customersChats: req.CustomersChats})
            })
    },
}

router.get('/', function (req, res, next){
    res.render('Merchants/merchantLogin', {title: 'Log in'});
})
router.get('/merchantPage',
    authMerchant,
    dataBaseObject.selectCategories,
    dataBaseObject.selectShop,
    function (req, res, next){
        res.render('Merchants/merchantsPage', {title: 'Merchant', user: req.session.merchant, shop: req.shop, categories: req.categories,
        alert: alert, cover: cover });
})
router.post('/update',
    authMerchant,
    dataBaseObject.updateShop,
    function (req, res, next) {
    res.sendStatus(200);
})
router.post('/changePassword',
    authMerchant,
    dataBaseObject.changePassword,
    function (req, res, next) {
        res.sendStatus(200);
})
router.get('/indexMerchant',
    authMerchant,
    dataBaseObject.selectShop,
    function (req, res, next){
        res.render('Merchants/indexMerchant', {title: 'Home', user: req.session.merchant, shop: req.shop});
})
/* Merchant registration */
router.get('/merchantRegister',
    dataBaseObject.selectCategories,
    function (req, res, next){
    res.render('Merchants/merchantRegister', {title: 'Register', categories: req.categories, alert: alert});
})
router.post('/registration',
    uploadProfile.single('profilePicture'),
    dataBaseObject.findCategory,
    dataBaseObject.insertMerchant,
    function (req, res, next){
        res.sendStatus(200);
})
router.post('/changeProfilePhoto',
    uploadProfile.single('newProfilePhoto'),
    dataBaseObject.changeProfilePhoto,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/changeCoverPhoto',
    uploadCover.single('newCoverPhoto'),
    dataBaseObject.changeCoverPhoto,
    function (req, res, next) {
        res.sendStatus(200);
    })
/* Merchant login */
router.get('/merchantLogin', function (req, res, next){
    res.render('Merchants/merchantLogin', {title: 'Log in', alert: alert});
})
router.post('/merchantLogin',
    dataBaseObject.logInMerchant,
    function (req, res, next) {
    //res.sendStatus(200);
})
//Add product
router.get('/products',
    authMerchant,
    dataBaseObject.selectCategories,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Merchants/products', { title: 'Products', user: req.session.merchant, categories: req.categories, shop: req.shop })
})
router.get('/productsCatalog',
    authMerchant,
    dataBaseObject.selectShopsProducts,
    dataBaseObject.selectShop,
    dataBaseObject.selectCategories,
    function (req, res, next) {
        res.render('Merchants/productsCatalog', { title: 'Products Catalog', user: req.session.merchant, products: req.products,
            shop: req.shop, categories: req.categories})
})
router.post('/addProduct',
    upload.array('photographs', 5),
    dataBaseObject.findShop,
    dataBaseObject.findCategory,
    dataBaseObject.addProduct,
    function (req, res, next) {
        res.redirect('productsCatalog');
})
router.get('/editProduct/:product',
    authMerchant,
    dataBaseObject.editProduct,
    function (req, res, next) {
        res.render('Merchants/editProduct', {title: 'Edit', user: req.session.merchant, product: req.product, msg: msg });
})
router.post('/updateProduct',
    dataBaseObject.updateProduct,
    function (req, res, next) {
        let p = req.body.product_id;
        msg = 'Changes saved!';
        res.redirect('/merchants/editProduct/' + p);
})
router.post('/deleteProduct/:product',
    dataBaseObject.deleteProduct,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/searchProduct',
    dataBaseObject.searchProduct,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Merchants/SearchProducts', {title: 'Search results', user: req.session.merchant, products: req.products, shop: req.shop })
    })
router.post('/searchShop',
    dataBaseObject.searchShop,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Merchants/SearchShops', {title: 'Search results', user: req.session.merchant, shops: req.shops, shop: req.shop})
})
router.get('/orders',
    authMerchant,
    dataBaseObject.selectPendingOrders,
    dataBaseObject.selectAcceptedOrders,
    dataBaseObject.selectOrders,
    dataBaseObject.selectShop,
    dataBaseObject.earnings,
    function (req, res, next) {
        res.render('Merchants/orders', { title:'Orders', shop: req.shop, pendingOrders: req.pendingOrders, acceptedOrders: req.acceptedOrders, orders: req.Orders,
            user: req.session.merchant, earnings: req.earnings})
})
router.post('/accept/:order_id',
    dataBaseObject.acceptOrder,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/declineOrder/:order_id',
    dataBaseObject.declineOrder,
    function (req, res, next) {
        res.sendStatus(200);
})
router.post('/deliverOrder/:order_id',
    dataBaseObject.deliverOrder,
    dataBaseObject.sendEmail,
    function (req, res, next) {
        res.sendStatus(200);
    })
router.post('/categoryFilter',
    dataBaseObject.categoryFilter,
    dataBaseObject.selectCategories,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Merchants/categoryFilter',  {title: 'Products', user: req.session.merchant, categoryFilter: req.categoryProducts,
            categories: req.categories, shop: req.shop})
})
router.get('/adminChat',
    authMerchant,
    dataBaseObject.selectShop,
    dataBaseObject.selectMessagesWithAdmin,
    function (req, res, next){
        res.render('Merchants/adminChat', { title: 'Chat', user: req.session.merchant, shop: req.shop, messages: req.MessagesWithAdmin})
})
router.get('/customersChat/',
    authMerchant,
    dataBaseObject.selectCustomersChats,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Merchants/customersChat', {title: 'Chat', user: req.session.merchant, shop: req.shop,  customersChats: req.CustomersChats})
})
router.get('/customersChat/:id',
    authMerchant,
    dataBaseObject.selectMessagesWithCustomers,
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('Merchants/merchant_customer', {title: 'Chat', user: req.session.merchant, shop: req.shop,
            messages: req.MessagesWithCustomer, customer: req.session.customer_id })
})
router.post('/searchCustomerChat',
    dataBaseObject.searchCustomersChats,
    function (req, res, next) {
        res.sendStatus(200);
})

// Log out
router.post('/logout', function (req, res, next){
    req.session.destroy(err => {
        res.redirect('/merchants/merchantLogin');
    })
})
router.get('/logout', function (req, res, next){
    req.session.destroy(err => {
        res.redirect('/merchants/merchantLogin');
    })
})


module.exports = router;
