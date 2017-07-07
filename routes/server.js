const express = require('express');
const router = express.Router();

const Server = require('../schemas/server');
const moment = require('moment');

const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const recaptcha = require('express-recaptcha');
const validator = require('validator');
const RateLimit = require('express-rate-limit');
const votifier = require('votifier-send');

moment.locale('es');

let store;
if (process.env.NODE_ENV !== 'production') {
    recaptcha.init('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe');
} else {
    recaptcha.init('6LfA8ScUAAAAAGyT1EyJ_ny3CWjyBTWqk6EHtQyS', '6LfA8ScUAAAAAOiXYKxUbKVCdPpvZFQXE5cMV_cI');
    store = new require('rate-limit-redis')({});
}

router.get('/', ensureLoggedIn('/login'), function (req, res, next) {
    Server.find({ owner: req.user._id }, function (err, servers) {
        if (err) return next(err);
        res.render('servers', {title: 'Mis servidores', user: req.user, servers: servers});
    });
});

router.get('/new', recaptcha.middleware.render, ensureLoggedIn('/login'), function (req, res, next) {
    res.render('new', {title: 'Crear nuevo', user: req.user, captcha: req.recaptcha});
});

const newLimiter = new RateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    delayAfter: 1,
    delayMs: 3 * 1000,
    max: 5,
    message: "No puedes crear tantos servidores en tan poco tiempo.",
    store: store
});
router.post('/new', newLimiter, recaptcha.middleware.verify, ensureLoggedIn('/login'), function (req, res, next) {
    if (req.recaptcha.error) {
        req.flash('danger', '¡No has completado el captcha!');
        return res.redirect('/server/');
    }
    if (!validator.isAlphanumeric(req.body.name, 'es-ES')) return showerror('El nombre contiene caracteres no permitidos', req, res);
    if (!validator.isIP(req.body.ip) && !validator.isURL(req.body.ip)) return showerror('La IP es inválida', req, res);
    if (req.body.games && !validator.isAscii(req.body.games)) return showerror('Las etiquetas contienen caracteres no permitidos', req, res);
    if (req.body.youtube && !validator.isURL(req.body.youtube, {host_whitelist: ['youtu.be', 'youtube.com']})) return showerror('El enlace al tráiler de YouTube no es válido', req, res);

    if(req.body.port && (req.body.port > 65535 || req.body.port <= 0)) return showerror('El puerto no es válido', req, res);

    let server = new Server({
        name: validator.escape(req.body.name),
        port: validator.toInt(req.body.port) || 25565,
        ip: validator.escape(req.body.ip),
        type: validator.toInt(req.body.type),
        description: validator.escape(req.body.description),
        games: req.body.games ? validator.escape(req.body.games).split(',').splice(0, 5) : [],
        owner: req.user._id,
        youtube: req.body.youtube,
        automatic: (process.env.NODE_ENV !== 'production'),

        // Votifier
        votifier_ip: validator.escape(req.body.votifier_ip),
        votifier_port: validator.toInt(req.body.votifier_port),
        votifier_key: req.body.votifier_key
    });

    server.save(function (err) {
        if (err) {
            req.flash('danger', "No se pudo registrar el servidor. Revisa que no halla sido añadido por otro usuario. Si crees que es un error avísanos en Twitter: @Servidores__MC");
            return res.redirect('/server');
        }

        req.flash('success', "¡Servidor registrado! Espera unos minutos para que sea procesado.");
        res.redirect('/server');
    });
});

router.post('/:id/edit', newLimiter, recaptcha.middleware.verify, ensureLoggedIn('/login'), function (req, res, next) {
    if (req.recaptcha.error) {
        req.flash('danger', '¡No has completado el captcha!');
        return res.redirect('/server/' + validator.escape(req.params.id));
    }
    Server.findOne({'_id': validator.escape(req.params.id)}).populate('owner').exec(function (err, server) {
        if (err) {
            req.flash('danger', '¡No se ha encontrado el servidor! Puede que halla sido borrado :S');
            return res.redirect('/');
        }

        if (server.owner._id !== req.user._id) return showerror('El servidor no te pertenece :P', req, res);

        if (!validator.isAlphanumeric(req.body.name, 'es-ES')) return showerror('El nombre contiene caracteres no permitidos', req, res);
        if (!validator.isIP(req.body.ip) && !validator.isURL(req.body.ip)) return showerror('La IP es inválida', req, res);
        if (req.body.games && !validator.isAscii(req.body.games)) return showerror('Las etiquetas contienen caracteres no permitidos', req, res);
        if (req.body.youtube && !validator.isURL(req.body.youtube, {host_whitelist: ['youtu.be', 'youtube.com']})) return showerror('El enlace al tráiler de YouTube no es válido', req, res);

        if (req.body.port && (req.body.port > 65535 || req.body.port <= 0)) return showerror('El puerto no es válido', req, res);

        server.name = validator.escape(req.body.name);
        server.port = validator.toInt(req.body.port) || 25565;
        server.ip = validator.escape(req.body.ip);
        server.type = validator.toInt(req.body.type);
        server.description = validator.escape(req.body.description);
        server.games = req.body.games ? validator.escape(req.body.games).split(',').splice(0, 5)  : [];
        server.youtube = req.body.youtube;

        // Votifier
        server.votifier_ip = validator.escape(req.body.votifier_ip);
        server.votifier_port = validator.toInt(req.body.votifier_port) || 8192;
        server.votifier_key = req.body.votifier_key;

        server.save(function (err) {
            if (err) {
                req.flash('danger', "No se pudo editar el servidor. Revisa que no halla sido añadido por otro usuario. Si crees que es un error avísanos en Twitter: @KernelFreeze");
                return res.redirect('/server');
            }

            req.flash('info', "Servidor editado");
            res.redirect('/server/' + req.params.id);
        });
    });
});

router.get('/:id', function (req, res, next) {
    Server.findOne({'_id': validator.escape(req.params.id)}).populate('owner').exec(function (err, server) {
        if(err) {
            req.flash('danger', '¡No se ha encontrado el servidor! Puede que halla sido borrado :S');
            return res.redirect('/');
        }
        res.render('server', {title: server.name, user: req.user, server: server, moment: moment});
    });
});

router.get('/:id/like', recaptcha.middleware.render, function (req, res, next) {
    Server.findOne({'_id': validator.escape(req.params.id)}).populate('owner').exec(function (err, server) {
        if(err) {
            req.flash('danger', '¡No se ha encontrado el servidor! Puede que halla sido borrado :(');
            return res.redirect('/');
        }
        res.render('vote', {title: server.name, user: req.user, server: server, captcha: req.recaptcha});
    });
});

router.get('/:id/edit', recaptcha.middleware.render, ensureLoggedIn('/login'), function (req, res, next) {
    Server.findOne({'_id': validator.escape(req.params.id)}).populate('owner').exec(function (err, server) {
        if(err) {
            req.flash('danger', '¡No se ha encontrado el servidor! Puede que halla sido borrado :(');
            return res.redirect('/');
        }
        if (server.owner._id !== req.user._id) return showerror('El servidor no te pertenece :P', req, res);

        res.render('edit', {title: server.name, user: req.user, server: server, captcha: req.recaptcha});
    });
});

const likeLimiter = new RateLimit({
    windowMs: 18 * 60 * 60 * 1000,
    delayAfter: 1,
    delayMs: 3 * 1000,
    max: 1,
    message: "Vuelve mañana para darle like a otro servidor.",
    store: store
});
router.post('/:id/like', likeLimiter, recaptcha.middleware.verify, function (req, res, next) {
    if (req.recaptcha.error) {
        req.flash('danger', '¡No has completado el captcha!');
        return res.redirect('/server/' + validator.escape(req.params.id) + '/like');
    }
    Server.findOne({'_id': validator.escape(req.params.id)}).populate('owner').exec(function (err, server) {
        if(err) {
            req.flash('danger', '¡No se ha encontrado el servidor! Puede que halla sido borrado :O');
            return res.redirect('/');
        }
        Server.update({_id: server._id}, {$inc: {likes: 1}}, function (err) {
            if (err) console.error(err);
            req.flash('success', "¡Te ha gustado este servidor!");
            res.redirect('/server/' + server._id);
        });

        if (req.body.user && server.votifier_ip && server.votifier_key) {
            let settings = {
                key: server.votifier_key,
                host: server.votifier_ip,
                port: server.votifier_port || 8192,
                data: {
                    user: validator.escape(req.body.user),
                    site: 'servidoresminecraft.co',
                    addr: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                    timestamp: new Date().getTime()
                }
            };
            votifer.send(settings, function(err){
                if(err) console.log(err);
            });
        }
    });
});

function showerror(err, req, res) {
    req.flash('danger', err);
    res.redirect('/server');
}

module.exports = router;
