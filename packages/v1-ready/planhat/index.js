const { Api } = require('./api');
const { Definition } = require('./definition');
const { companyMapping } = require('./mappings/company');
const { contactMapping } = require('./mappings/contact');
const { accountHealthMapping } = require('./mappings/account-health');

/**
 * Named transforms referenced by mappings/* (ADR-057).
 * Kept empty for now — Planhat company/enduser fields map 1:1 without
 * transforms. Placeholder reserved so hosts can register named transforms
 * without changing the package export shape.
 */
const mappingTransforms = {};

module.exports = {
    Api,
    Definition,
    extensions: {
        mapping: {
            schemas: {
                // business@1 — company + contact (enduser)
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...companyMapping.objects,
                        ...contactMapping.objects,
                    },
                },
                // accountHealth@1 — sameAs-only Frigg AccountHealth model
                accountHealth: {
                    schema: 'accountHealth@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...accountHealthMapping.objects,
                    },
                },
            },
            transforms: mappingTransforms,
        },
    },
};
