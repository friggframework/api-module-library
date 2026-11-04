const { Api } = require('./api');
const { Definition } = require('./definition');
const { contactMapping } = require('./mappings/contact');
const { companyMapping } = require('./mappings/company');
const { accountHealthMapping } = require('./mappings/account-health');

/**
 * Compose ADR-057 business@1 mappings. Fragments are labeled UNVALIDATED:
 * field paths follow official Vitally REST Account/User shapes but have not
 * been validated against a live Vitally sandbox yet.
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
        mapping: {
            schemas: {
                business: businessMapping,
                // AccountHealth is Frigg-owned (sameAs-only); not part of business@1.
                AccountHealth: accountHealthMapping,
            },
        },
    },
};
