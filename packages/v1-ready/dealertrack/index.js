const { Api } = require('./api');
const { Definition } = require('./definition');
const { businessMapping } = require('./mappings/business');

module.exports = {
    Api,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                business: businessMapping,
            },
            transforms: {},
        },
    },
};
