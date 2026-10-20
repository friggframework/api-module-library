const { Api } = require('./api');
const { Definition } = require('./definition');
const Config = require('./defaultConfig.json');
const webhooks = require('./extensions/webhooks');

module.exports = {
    Api,
    Config,
    Definition,
    extensions: {
        webhooks,
    },
};
