/**
 * Planhat Company health fields → Frigg AccountHealth model (ADR-057).
 *
 * Status: UNVALIDATED — sameAs-only mapping onto a Frigg-owned AccountHealth
 * object (not schema.org). Planhat exposes health on the Company model
 * (`h`, `hProfile`, `csmScore`, `hDiff`, …); there is no dedicated health
 * REST resource.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Planhat Company health fields: https://www.planhat.com/developers/api/company
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.accountHealth`).
 */

const accountHealthMapping = {
    schema: 'accountHealth@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'AccountHealth',
                sameAs: 'https://friggframework.org/canonical/AccountHealth',
                identity: ['remote_id'],
                fields: {
                    _id: 'remote_id',
                    name: 'account_name',
                    h: 'score',
                    hProfile: 'profile_id',
                    csmScore: 'csm_score',
                    hDiff: 'score_delta',
                    hDiffDate: 'score_delta_at',
                    orgHealthTotal: 'org_score',
                    lastUpdated: 'remote_updated_at',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { accountHealthMapping };
