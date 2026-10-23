/**
 * ADR-057 mapping: Vitally Account health → Frigg-owned AccountHealth model.
 *
 * AccountHealth is not part of business@1. This fragment is sameAs-only to a
 * Frigg-owned URI (ours), per the Left Hook demand-source CS signal contract.
 *
 * Sources:
 *   https://docs.vitally.io/en/articles/9880654-rest-api-accounts
 *     (Account.healthScore; GET /accounts/:id/healthScores)
 *   https://docs.vitally.io/en/articles/9901284-health-scores
 *
 * Status is UNVALIDATED until confirmed against a live Vitally sandbox.
 */
const accountHealthMapping = {
    schema: 'AccountHealth@1',
    status: 'UNVALIDATED',
    objects: {
        account: [
            {
                to: 'AccountHealth',
                sameAs: 'https://friggframework.org/canonical/AccountHealth',
                identity: ['externalIds.vitally', 'id'],
                fields: {
                    id: 'accountId',
                    healthScore: 'score',
                    npsScore: 'npsScore',
                    npsPromoterCount: 'npsPromoterCount',
                    npsPassiveCount: 'npsPassiveCount',
                    npsDetractorCount: 'npsDetractorCount',
                },
                ops: ['read'],
                notes:
                    'UNVALIDATED: overall Account.healthScore (0–10). Per-category breakdown via getAccountHealthScores.',
            },
        ],
        accountHealthBreakdown: [
            {
                to: 'AccountHealth',
                sameAs: 'https://friggframework.org/canonical/AccountHealth',
                identity: ['externalIds.vitally'],
                fields: {},
                ops: ['read'],
                notes:
                    'UNVALIDATED: sameAs-only placeholder for GET /accounts/:id/healthScores category breakdown payloads (shape varies by tenant health config).',
            },
        ],
    },
};

module.exports = { accountHealthMapping };
