const express = require('express');
const router = express.Router();
const Server = require('../schemas/server');

router.post('/', function (req, res, next) {
    if (req.body.search) return res.redirect(`/search/${req.body.search}`);

    res.redirect('/');
});

router.get('/:query/:page?', function (req, res, next) {
    Server.paginate({$text: {$search: req.params.query}}, { page: Math.abs(req.params.page) || 1, limit: 10, sort: { likes: -1, players: -1 }}, function (err, result) {
        if(err) return next(err);

        if(result.page > result.pages) return res.redirect(result.pages);
        res.render('view', {title: 'Resultados de la búsqueda', user: req.user, servers: result.docs, pagination: result, show_type: true, url: '/search/' + req.params.query + '/'});
    });
});

module.exports = router;
