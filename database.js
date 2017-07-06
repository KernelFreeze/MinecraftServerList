const mongoose = require('mongoose');
const url = 'mongodb://db:eW652H4QRPPqXtM@ds147872.mlab.com:47872/mc';

mongoose.connect(url);

let db = mongoose.connection;

db.on('error', console.error.bind(console, 'Database connection error:'));

module.exports = {
    mongoose,
    url,
    db
};
