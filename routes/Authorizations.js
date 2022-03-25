function authAdmin(req, res, next){

    if(req.session.admin == null) {
        res.redirect('/adminLogin/restrictAdminPage');
    }
    else {
        next();
    }
}
function authAdminM(req, res, next){

    if(req.session.admin == null) {
        res.redirect('/adminLogin/restrictAdminPage');
    }
    else {
        next();
      //  res.render('adminMerch', {title: 'EditMerchants'});
    }
}
function authAdminC(req, res, next){

    if(req.session.admin == null) {
        res.redirect('/adminLogin/restrictAdminPage');
    }
    else {
        next();
       // res.render('adminCustomers', {title: 'EditCustomers'});
    }
}
function authCustomer(req, res, next) {
    if(req.session.customer == null) {
        res.render('accessdenied', {title: 'Error'});
    }
    else {
        next();
    }
}
function authMerchant(req, res, next) {
    if(req.session.merchant == null) {
        res.render('accessdenied', {title: 'Error'});
    }
    else {
        next();
    }
}

module.exports = {
    authAdmin,
    authAdminM,
    authAdminC,
    authCustomer,
    authMerchant,
}