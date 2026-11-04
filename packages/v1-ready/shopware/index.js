const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { contactMapping } = require('./mappings/contact');
const { paymentMapping } = require('./mappings/payment');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                business: contactMapping,
                billing: paymentMapping,
            },
            transforms: {},
        },
    },
};
