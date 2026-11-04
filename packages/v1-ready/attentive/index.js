const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { contactMapping } = require('./mappings/contact');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                business: contactMapping,
            },
            transforms: {},
        },
    },
};
