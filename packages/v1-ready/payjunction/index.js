const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const companyMapping = require('./mappings/company');
const contactMapping = require('./mappings/contact');
const invoiceMapping = require('./mappings/invoice');
const paymentMapping = require('./mappings/payment');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                // ADR-057 — UNVALIDATED until the canonical registry exists
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...companyMapping.objects,
                        ...contactMapping.objects,
                    },
                },
                billing: {
                    schema: 'billing@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...invoiceMapping.objects,
                        ...paymentMapping.objects,
                    },
                },
            },
            transforms: {},
        },
    },
};
