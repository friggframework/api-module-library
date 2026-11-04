const { Api } = require('./api');
const { Definition, hashEnvironmentId } = require('./definition');
const Config = require('./defaultConfig.json');
const webhooks = require('./extensions/webhooks');
const companyMapping = require('./mappings/company');
const contactMapping = require('./mappings/contact');

// Constituent maps to both Company (Organization) and Contact (Individual);
// merge arrays so one key does not clobber the other.
const businessObjects = {
    constituent: [
        ...(companyMapping.objects.constituent || []),
        ...(contactMapping.objects.constituent || []),
    ],
};

module.exports = {
    Api,
    Definition,
    Config,
    hashEnvironmentId,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: businessObjects,
                },
            },
        },
    },
};
