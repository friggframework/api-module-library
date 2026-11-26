const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        // No ADR-057 mappings: Drive files / Calendar events do not map cleanly
        // onto business@1 (Company/Contact/Deal), support@1, or billing@1.
    },
};
