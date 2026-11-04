const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { conversationMapping } = require('./mappings/conversation');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                support: conversationMapping,
            },
            transforms: {},
        },
    },
};
