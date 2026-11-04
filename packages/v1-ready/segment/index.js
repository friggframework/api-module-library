const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { contactMapping } = require('./mappings/contact');
const { companyMapping } = require('./mappings/company');

/**
 * Compose ADR-057 business@1 mappings. Both fragments are labeled UNVALIDATED:
 * field paths follow official Profile API trait/account shapes but have not
 * been validated against a live Unify space yet.
 */
const businessMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        ...contactMapping.objects,
        ...companyMapping.objects,
    },
};

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                business: businessMapping,
            },
        },
    },
};
