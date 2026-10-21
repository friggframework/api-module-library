/**
 * Totango Account (health fields via Search) → AccountHealth.
 *
 * AccountHealth is an adopter/Left Hook–owned canonical model (not part of
 * business@1). Per ADR-057 it is declared sameAs-only here — field vocabulary
 * lives in the mapping, not in a published schema package yet.
 *
 * Totango has no dedicated health-score REST resource. Health is read by
 * requesting Search account fields:
 *   {"type":"string","term":"health",...} → color rank in selected_fields
 *   {"type":"health_trend",...} → { health, health_prev, change_date }
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users
 *   https://support.totango.com/hc/en-us/articles/360032136152-Analyze-health-at-the-account-level
 *   ADR-057: docs/architecture-decisions/057-canonical-schema.md (frigg next)
 */
const accountHealthMapping = {
    schema: 'accountHealth@1',
    validation: 'UNVALIDATED',
    model: {
        AccountHealth: {
            sameAs: 'https://friggframework.org/canonical/AccountHealth',
        },
    },
    objects: {
        account: [
            {
                to: 'AccountHealth',
                identity: ['externalIds.totango', 'name'],
                fields: {
                    name: 'accountId',
                    display_name: 'accountName',
                    health: 'health',
                    health_prev: 'previousHealth',
                    change_date: 'healthChangedAt',
                    last_activity_time: 'lastActivityAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = accountHealthMapping;
