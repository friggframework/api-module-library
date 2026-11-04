/**
 * monday.com board item → canonical Company (business@1).
 *
 * On monday CRM, Accounts/Companies are items on an Accounts board (column
 * layout is board-specific). Hosts should also filter by Accounts board id
 * when `board.type` is not populated.
 *
 * Status: UNVALIDATED (ADR-057 draft; no published
 * @friggframework/canonical-schema-business package to Test-Bench against).
 *
 * Sources:
 *   https://developer.monday.com/api-reference/reference/items
 *   https://developer.monday.com/api-reference/reference/boards
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        item: [
            {
                when: {
                    field: 'board.type',
                    in: ['crm_account', 'accounts', 'account'],
                },
                to: 'Company',
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

module.exports = companyMapping;
