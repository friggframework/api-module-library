const { Api, MondayGraphqlError, verifyHs256Jwt, tokenFromAuthorization } = require('./api');
const { Definition } = require('./definition');
const Config = require('./defaultConfig.json');
const webhooks = require('./extensions/webhooks');
const companyMapping = require('./mappings/company');
const contactMapping = require('./mappings/contact');
const dealMapping = require('./mappings/deal');

// monday CRM objects are all board items; merge the item→Company/Contact/Deal
// mapping rules into one `item` array (spread would clobber same-key objects).
const businessObjects = {
    item: [
        ...(companyMapping.objects.item || []),
        ...(contactMapping.objects.item || []),
        ...(dealMapping.objects.item || []),
    ],
};

module.exports = {
    Api,
    Definition,
    Config,
    MondayGraphqlError,
    verifyHs256Jwt,
    tokenFromAuthorization,
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
