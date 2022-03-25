var express = require('express');
var router = express.Router();
//Connecting to the ElephantSQL DataBase

var io = null;
var admin = 0, customer = 1, merchant = 2;

const { Pool, Client } = require('pg')
const pool = new Pool({
  user: 'uijvqpvp',
  host: 'ella.db.elephantsql.com',
  database: 'uijvqpvp',
  password: 'TQNc3M530lNpfFl6aj3O1LUH1KYpkrbK',
  port: 5432,
  max: 10,
  idleTimeoutMillis: 3000
})

var dataBaseObject = {
    randomRecommend : function (req, res, next) {
        pool.query(`select product_id, product_name, product_desc, price, unit, photo_path, s.shopname from products 
                    inner join shopinformations s on s.shop_id = products.shop_id
                    limit 5`,
            (err, result) => {
                req.randomProducts = result.rows;
                next();
            })
    },
    productInfo: function (req, res, next) {
        pool.query(`select product_id, product_name, product_desc, price, unit, photo_path, s.shopname from products
                    inner join shopinformations s on s.shop_id = products.shop_id where product_id = $1`,
            [req.params.id],
            (err, result) => {
                req.product = result.rows;
                console.info(req.product);
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
    selectShopsProducts : function (req, res, next) {
        pool.query(`select * from products as p inner join shopinformations s on s.shop_id = p.shop_id 
                    where s.shopname = $1`, [req.params.shop],
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
    searchProduct : function (req, res, next) {
        pool.query(`select * from products p inner join shopinformations s on s.shop_id = p.shop_id where product_name like '%' || $1 || '%'`,
            [req.body.searchProduct],
            (err, result) => {
                req.products = result.rows;
                next();
            });
    },
}

router.get('/',
    function(req, res, next) {
  if(!io) {
      io = require('socket.io')(req.connection.server);
      io.sockets.on('connection', (client) => {
          console.info("We have a new connection!!!");
          client.on('disconnect', (client) => {
              console.info("Disconnected!");
          })
          client.on('send_message_to_admin', message_packet => {
              pool.query(`insert into chat(sender_id, receiver_id, message, code_from, code_to, time) values ($1, $2, $3, $4, $5, $6)`,
                  [message_packet.sender_id, message_packet.receiver_id, message_packet.message, customer, admin, message_packet.date],
                  (err, result) => {
                      console.info(message_packet);
                      io.emit('message_to_admin', message_packet);
                  })
          })
          client.on('send_message_to_customer', message_packet => {
              pool.query(`insert into chat(sender_id, receiver_id, message, code_from, code_to, time) values ($1, $2, $3, $4, $5, $6)`,
                  [message_packet.sender_id, message_packet.receiver_id, message_packet.message, admin, customer, message_packet.date],
                  (err, result) => {
                      io.emit('message_to_customer', message_packet);
                  })
          })
          client.on('send_message_to_admin_merchant', message_packet => {
              pool.query(`insert into chat(sender_id, receiver_id, message, code_from, code_to, time) values ($1, $2, $3, $4, $5, $6)`,
                  [message_packet.sender_id, message_packet.receiver_id, message_packet.message, merchant, admin, message_packet.date],
                  (err, result) => {
                      io.emit('message_to_admin_merchant', message_packet);
                  })
          })
          client.on('send_message_to_merchant', message_packet => {
              pool.query(`insert into chat(sender_id, receiver_id, message, code_from, code_to, time) values ($1, $2, $3, $4, $5, $6)`,
                  [message_packet.sender_id, message_packet.receiver_id, message_packet.message, admin, merchant, message_packet.date],
                  (err, result) => {
                      io.emit('message_to_merchant', message_packet);
                  })
          })
          client.once('send_message_to_customer_merchant', message_packet => {
              pool.query(`insert into chat(sender_id, receiver_id, message, code_from, code_to, time) values ($1, $2, $3, $4, $5, $6)`,
                  [message_packet.sender_id, message_packet.receiver_id, message_packet.message, merchant, customer, message_packet.date],
                  (err, result) => {
                      io.emit('message_to_customer', message_packet);
                  })
          })
          client.once('send_message_to_merchant_customer', message_packet => {
              pool.query(`insert into chat(sender_id, receiver_id, message, code_from, code_to, time) values ($1, $2, $3, $4, $5, $6)`,
                  [message_packet.sender_id, message_packet.receiver_id, message_packet.message, customer, merchant, message_packet.date],
                  (err, result) => {
                      io.emit('message_to_merchant', message_packet);
                  })
          })
          client.on('order_placed', message => {
              console.info(message);
              io.emit('new_order', message);
          })
      })
  }
  res.render('index', { title: 'Web Shop', randomProducts: req.randomProducts });
});

router.get('/product/:id',
    dataBaseObject.productInfo,
    function (req, res, next){
        res.render('product', { title: 'Product', product: req.product })
})
router.get('/shop/:shop',
    dataBaseObject.selectShop,
    function (req, res, next) {
        res.render('shop', {title: 'Shop', user: req.session.customer, shop: req.shop})
    })
router.get('/productsCatalog/:shop',
    dataBaseObject.selectShop,
    dataBaseObject.selectShopsProducts,
    function (req, res, next) {
        res.render('productsCatalog', { title: 'Products Catalog', products: req.products, shop: req.shop })
})
router.post('/searchShop',
    dataBaseObject.searchShop,
    function (req, res, next) {
        res.render('SearchShops', {title: 'Search results', shops: req.shops })
})
router.post('/searchProduct',
    dataBaseObject.searchProduct,
    function (req, res, next) {
        res.render('SearchProducts', {title: 'Search results', products: req.products })
})
module.exports = router;
