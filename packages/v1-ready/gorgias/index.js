const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { supportMapping } = require('./mappings/ticket');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                support: supportMapping,
            },
            transforms: {},
        },
    },
};
