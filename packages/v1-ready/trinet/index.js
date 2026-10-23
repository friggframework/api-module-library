const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');

module.exports = {
    Api,
    Definition,
    extensions: { webhooks },
};
