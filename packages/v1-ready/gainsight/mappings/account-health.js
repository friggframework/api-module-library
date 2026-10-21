/**
 * Gainsight Scorecard / health signal → AccountHealth (sameAs-only, ours).
 *
 * Status: UNVALIDATED (ADR-057).
 *
 * Gainsight does not publish a dedicated Scorecard REST API for reads/writes.
 * Official guidance (Scorecard FAQs): read Scorecard data via the Custom Object
 * API against tenant-specific scorecard object names. Until a tenant's object
 * schema is verified, this mapping declares only `sameAs` identity onto our
 * AccountHealth model — no field map.
 *
 * Sources:
 *   https://support.gainsight.com/gainsight_nxt/05Scorecards/FAQs/Scorecard_FAQs
 *   https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Custom_Object_API/Gainsight_Custom_Object_API_Documentation
 *   ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 */
const accountHealthMapping = {
    schema: 'AccountHealth@1',
    validation: 'UNVALIDATED',
    objects: {
        // Tenant-specific scorecard / health custom objects queried via
        // Api.queryCustomObject(objectName, body).
        scorecardObject: [
            {
                to: 'AccountHealth',
                // sameAs-only (ours) — no schema.org / Merge type alignment yet.
                sameAs: 'https://friggframework.org/canonical/AccountHealth',
                identity: ['Gsid'],
                fields: {},
                ops: ['read'],
            },
        ],
    },
};

module.exports = accountHealthMapping;
