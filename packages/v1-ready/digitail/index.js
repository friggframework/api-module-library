const { Api } = require('./api');
const { Definition } = require('./definition');
const { clinicMapping } = require('./mappings/clinic');
const { petParentMapping } = require('./mappings/petParent');
const { invoiceMapping } = require('./mappings/invoice');

module.exports = {
    Api,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                // business@1 — UNVALIDATED until the canonical registry is verified
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...clinicMapping.objects,
                        ...petParentMapping.objects,
                    },
                },
                // billing@1 — UNVALIDATED until the canonical registry exists
                billing: {
                    ...invoiceMapping,
                },
            },
            transforms: {},
        },
    },
};
