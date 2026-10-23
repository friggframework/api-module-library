/**
 * Raiser's Edge NXT Constituent (Individual) → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.blackbaud.com/skyapi/products/renxt/constituent
 *
 * Gifts, events, funds, and appeals are omitted — they do not map cleanly onto
 * business@1 Company / Contact / Deal (or support@1 / billing@1).
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        constituent: [
            {
                to: 'Contact',
                when: { type: 'Individual' },
                identity: ['externalIds.raisersedge', 'email.address'],
                fields: {
                    id: 'id',
                    first: 'firstName',
                    last: 'lastName',
                    name: 'name',
                    'email.address': 'email',
                    'phone.number': 'phone',
                    title: 'title',
                    lookup_id: 'lookupId',
                    date_added: 'createdAt',
                    date_modified: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = contactMapping;
