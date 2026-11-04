/**
 * ChurnZero account-health signal → AccountHealth (ADR-057).
 *
 * Status: UNVALIDATED — sameAs-only. There is no Merge (or other third-party)
 * AccountHealth common model to align fields against. Until Frigg publishes a
 * shared registry entry, this mapping only declares our canonical type via
 * `sameAs` and does not invent field maps.
 *
 * Provider objects that carry health signal (for discovery / future field maps):
 * - Account.PrimaryChurnScoreValue / PrimaryChurnScoreId
 * - ChurnScoreCalculation.Score (per-account calculated scores)
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - ChurnZero Account / ChurnScoreCalculation:
 *   https://app.churnzero.net/developers
 *   https://app.churnzero.net/developers/churnzero_oas.json
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.accountHealth`).
 */

const accountHealthMapping = {
    schema: 'accountHealth@1',
    validation: 'UNVALIDATED',
    objects: {
        AccountHealth: {
            sameAs: 'https://friggframework.org/canonical/AccountHealth',
        },
        account: [
            {
                to: 'AccountHealth',
                sameAs: 'https://friggframework.org/canonical/AccountHealth',
                ops: ['read'],
            },
        ],
        churnScoreCalculation: [
            {
                to: 'AccountHealth',
                sameAs: 'https://friggframework.org/canonical/AccountHealth',
                ops: ['read'],
            },
        ],
    },
};

module.exports = { accountHealthMapping };
