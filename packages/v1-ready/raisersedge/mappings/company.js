/**
 * Raiser's Edge NXT Constituent (Organization) → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.blackbaud.com/skyapi/products/renxt/constituent
 *
 * Organization constituents are the closest RE NXT analogue to Company.
 * Individual constituents map via mappings/contact.js instead.
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        constituent: [
            {
                to: 'Company',
                when: { type: 'Organization' },
                identity: ['externalIds.raisersedge', 'name'],
                fields: {
                    id: 'id',
                    name: 'name',
                    'email.address': 'email',
                    'phone.number': 'phone',
                    lookup_id: 'lookupId',
                    date_added: 'createdAt',
                    date_modified: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = companyMapping;
