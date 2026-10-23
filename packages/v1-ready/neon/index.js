const { Api } = require('./api');
const { Definition } = require('./definition');
const Config = require('./defaultConfig.json');
const webhooks = require('./extensions/webhooks');
const companyMapping = require('./mappings/company');
const contactMapping = require('./mappings/contact');

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
                        ...companyMapping.objects,
                        ...contactMapping.objects,
                    },
                },
            },
        },
    },
};
