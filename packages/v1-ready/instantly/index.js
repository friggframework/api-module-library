const { Api } = require('./api');
const { Definition } = require('./definition');
const { contactMapping } = require('./mappings/contact');

/**
 * Compose ADR-057 business@1 mappings. Fragments are labeled UNVALIDATED:
 * field paths follow official Instantly Lead shapes but have not been
 * validated against a live Instantly sandbox yet.
 *
 * Campaign (email sequence), Account (sending mailbox), LeadList, and Webhook
 * do not map cleanly onto business@1 Company/Deal or support@1 / billing@1 —
 * see README / PR for the skip rationale.
 */
const businessMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        ...contactMapping.objects,
    },
};

module.exports = {
    Api,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                business: businessMapping,
            },
        },
    },
};
