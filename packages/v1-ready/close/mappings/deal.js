/**
 * Close Opportunity → canonical Deal (business@1).
 *
 * Deal follows Apideck Opportunity/Deal field names for win/loss reasons:
 * lossReason, lossReasonId, wonReason (and wonReasonId when available).
 *
 * Close does not expose dedicated loss_reason / won_reason string fields on
 * Opportunity. Win/loss is modeled via status_type (active|won|lost) plus
 * status_id / status_label. Conditional mappings below align those to
 * Apideck-style reason fields.
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.close.com/api/resources/opportunities.md
 *   https://api.close.com/api/openapi.json (Opportunity schema)
 *   https://developers.apideck.com/apis/crm/reference/opportunities
 */
const sharedDealFields = {
    id: 'id',
    lead_id: 'companyId',
    contact_id: 'contactId',
    lead_name: 'name',
    value: 'amount',
    value_currency: 'currency',
    value_period: 'amountPeriod',
    confidence: 'probability',
    status_id: 'statusId',
    status_label: 'status',
    status_type: 'statusType',
    pipeline_id: 'pipelineId',
    pipeline_name: 'pipeline',
    date_won: 'wonAt',
    date_lost: 'lostAt',
    date_created: 'createdAt',
    date_updated: 'updatedAt',
    user_id: 'ownerId',
    note: 'description',
};

const dealMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        opportunity: [
            {
                when: { field: 'status_type', in: ['lost'] },
                to: 'Deal',
                identity: ['externalIds.close', 'id'],
                fields: {
                    ...sharedDealFields,
                    status_label: 'lossReason',
                    status_id: 'lossReasonId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                when: { field: 'status_type', in: ['won'] },
                to: 'Deal',
                identity: ['externalIds.close', 'id'],
                fields: {
                    ...sharedDealFields,
                    status_label: 'wonReason',
                    status_id: 'wonReasonId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                to: 'Deal',
                identity: ['externalIds.close', 'id'],
                fields: sharedDealFields,
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = dealMapping;
