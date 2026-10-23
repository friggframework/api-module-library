/**
 * GoHighLevel Opportunity → canonical Deal (business@1).
 *
 * Deal follows Apideck Opportunity/Deal field names for win/loss reasons:
 * lossReason, lossReasonId, wonReason (and wonReasonId when available).
 *
 * GHL opportunities use status enum: open | won | lost | abandoned | all.
 * Conditional mappings below align lost/won status to Apideck-style reason fields
 * using status / pipelineStageId when dedicated reason fields are absent.
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunity
 *   https://marketplace.gohighlevel.com/docs/Authorization/Scopes (opportunities.*)
 *   https://developers.apideck.com/apis/crm/reference/opportunities
 */
const sharedDealFields = {
    id: 'id',
    name: 'name',
    monetaryValue: 'amount',
    currency: 'currency',
    pipelineId: 'pipelineId',
    pipelineStageId: 'stageId',
    status: 'status',
    contactId: 'contactId',
    locationId: 'locationId',
    assignedTo: 'ownerId',
    source: 'source',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
};

const dealMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        opportunity: [
            {
                when: { field: 'status', in: ['lost', 'abandoned'] },
                to: 'Deal',
                identity: ['externalIds.gohighlevel', 'id'],
                fields: {
                    ...sharedDealFields,
                    status: 'lossReason',
                    pipelineStageId: 'lossReasonId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                when: { field: 'status', in: ['won'] },
                to: 'Deal',
                identity: ['externalIds.gohighlevel', 'id'],
                fields: {
                    ...sharedDealFields,
                    status: 'wonReason',
                    pipelineStageId: 'wonReasonId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
            {
                to: 'Deal',
                identity: ['externalIds.gohighlevel', 'id'],
                fields: sharedDealFields,
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = dealMapping;
