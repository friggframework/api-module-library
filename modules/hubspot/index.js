const {Api} = require('./api');
const {Definition} = require('./definition');
const Config = require('./defaultConfig');
const webhooks = require('./extensions/webhooks');

module.exports = {
    Api,
    Config,
    Definition,
    extensions: {
        webhooks,
    },
};
