const { Api } = require('./api');
const { Definition } = require('./definition');
const Config = require('./defaultConfig');
const companyMapping = require('./mappings/company');
const contactMapping = require('./mappings/contact');
const accountHealthMapping = require('./mappings/account-health');

module.exports = {
    Api,
    Config,
    Definition,
    extensions: {
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
                accountHealth: {
                    schema: accountHealthMapping.schema,
                    validation: accountHealthMapping.validation,
                    model: accountHealthMapping.model,
                    objects: accountHealthMapping.objects,
                },
            },
        },
    },
};
