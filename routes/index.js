const express = require('express');
const router = express.Router();
const Server = require('../schemas/server');

router.get('/:page(\\d+)?', function (req, res, next) {
    Server.paginate({}, { page: Math.abs(req.params.page) || 1, limit: 10, sort: { likes: -1, players: -1 }}, function (err, result) {
        if(err) return next(err);

        if(result.page > result.pages) return res.redirect(result.pages);
        res.render('index', {title: 'Destacados', user: req.user, servers: result.docs, pagination: result});
    });
});

router.get('/players/:page(\\d+)?', function (req, res, next) {
    Server.paginate({}, { page: Math.abs(req.params.page) || 1, limit: 10, sort: { players: -1, likes: -1 }}, function (err, result) {
        if(err) return next(err);

        if(result.page > result.pages) return res.redirect(result.pages);
        res.render('view', {title: 'Servidores con más jugadores', user: req.user, servers: result.docs, pagination: result, show_type: true, url: '/players'});
    });
});

router.get('/free/:page(\\d+)?', function (req, res, next) {
    Server.paginate({ type: { $ne: 2 } }, { page: Math.abs(req.params.page) || 1, limit: 10, sort: { likes: -1, players: -1 }}, function (err, result) {
        if(err) return next(err);

        if(result.page > result.pages) return res.redirect(result.pages);
        res.render('view', {title: '¡Servidores No-premium!', user: req.user, servers: result.docs, pagination: result, show_type: false, url: '/free'});
    });
});

router.get('/premium/:page(\\d+)?', function (req, res, next) {
    Server.paginate({ type: 2 }, { page: Math.abs(req.params.page) || 1, limit: 10, sort: { likes: -1, players: -1 }}, function (err, result) {
        if(err) return next(err);

        if(result.page > result.pages) return res.redirect(result.pages);
        res.render('view', {title: '¡Servidores Premium!', user: req.user, servers: result.docs, pagination: result, show_type: false, url: '/premium'});
    });
});

router.get('/tos', function (req, res, next) {
    res.render('tos', {title: 'Términos del servicio', user: req.user});
});

router.get('/who', function (req, res, next) {
    if(req.user) {
        res.send(req.user._id)
    } else {
        res.send('Debes iniciar sesión.')
    }
});

module.exports = router;
