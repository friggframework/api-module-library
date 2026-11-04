/**
 * monday.com board item → canonical Deal (business@1).
 *
 * Deal follows Apideck Opportunity/Deal field names for win/loss reasons:
 * lossReason, lossReasonId, wonReason (and wonReasonId when available).
 *
 * monday CRM Deals are items; win/loss is typically reflected in group title
 * or a status column (board-specific). Conditional mappings below use common
 * group titles; column-based reasons remain an open question.
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.monday.com/api-reference/reference/items
 *   https://developers.apideck.com/apis/crm/reference/opportunities
 */
const sharedDealFields = {
    id: 'id',
    name: 'name',
    'board.id': 'pipelineId',
    'group.id': 'stageId',
    'group.title': 'stage',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    state: 'statusType',
};

const dealMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        item: [
            {
                when: {
                    field: 'board.type',
                    in: ['crm_deal', 'deals', 'deal', 'opportunities'],
                },
                to: 'Deal',
                identity: ['externalIds.monday', 'id'],
                fields: sharedDealFields,
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                when: {
                    field: 'group.title',
                    in: ['Lost', 'lost', 'Closed Lost'],
                },
                to: 'Deal',
                identity: ['externalIds.monday', 'id'],
                fields: {
                    ...sharedDealFields,
                    'group.title': 'lossReason',
                    'group.id': 'lossReasonId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                when: {
                    field: 'group.title',
                    in: ['Won', 'won', 'Closed Won'],
                },
                to: 'Deal',
                identity: ['externalIds.monday', 'id'],
                fields: {
                    ...sharedDealFields,
                    'group.title': 'wonReason',
                    'group.id': 'wonReasonId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = dealMapping;
