/**
 * monday.com board item → canonical Contact (business@1).
 *
 * CRM Contacts are items on a Contacts board. Email/phone live in
 * column_values whose ids vary by board — only stable item fields are mapped.
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.monday.com/api-reference/reference/items
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        item: [
            {
                when: {
                    field: 'board.type',
                    in: ['crm_contact', 'contacts', 'contact'],
                },
                to: 'Contact',
                identity: ['externalIds.monday', 'id'],
                fields: {
                    id: 'id',
                    name: 'name',
                    'board.id': 'boardId',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                    state: 'status',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = contactMapping;
