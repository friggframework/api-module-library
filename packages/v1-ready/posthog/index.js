const { Api } = require('./api');
const { Definition } = require('./definition');
const { contactMapping } = require('./mappings/contact');

module.exports = {
    Api,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                business: contactMapping,
            },
            transforms: {},
        },
    },
};
