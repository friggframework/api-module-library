const { Api } = require('./api');
const { Definition } = require('./definition');
const Config = require('./defaultConfig');
const webhooks = require('./extensions/webhooks');
const supplierMapping = require('./mappings/company');

module.exports = {
    Api,
    Config,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...supplierMapping.objects,
                    },
                },
            },
        },
    },
};
