const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { subscriptionMapping } = require('./mappings/subscription');
const { invoiceMapping } = require('./mappings/invoice');
const { paymentMapping } = require('./mappings/payment');

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                // billing@1 — UNVALIDATED until the canonical registry exists
                billing: {
                    ...subscriptionMapping,
                    objects: {
                        ...subscriptionMapping.objects,
                        ...invoiceMapping.objects,
                        ...paymentMapping.objects,
                    },
                },
            },
            transforms: {},
        },
    },
};
