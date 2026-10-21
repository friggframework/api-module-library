/**
 * ChurnZero Account → canonical Company mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Company` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Company: https://docs.merge.dev/crm/companies/
 * - ChurnZero Account: https://app.churnzero.net/developers
 *   (official OpenAPI schema ChurnZero.Account)
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        account: [
            {
                to: 'Company',
                identity: ['remote_id', 'remote_id_alt'],
                fields: {
                    Id: 'remote_id',
                    ExternalId: 'remote_id_alt',
                    Name: 'name',
                    BillingAddressLine1: 'address.street_1',
                    BillingAddressLine2: 'address.street_2',
                    BillingAddressCity: 'address.city',
                    BillingAddressState: 'address.state',
                    BillingAddressZip: 'address.postal_code',
                    BillingAddressCountry: 'address.country',
                    ObjectCreatedDate: 'remote_created_at',
                    ObjectLastModifiedDate: 'remote_updated_at',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { companyMapping };
