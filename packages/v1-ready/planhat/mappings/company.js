/**
 * Planhat Company → canonical Company mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Company` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Company: https://docs.merge.dev/crm/companies/
 * - Planhat Company: https://www.planhat.com/developers/api/company
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'Company',
                identity: ['remote_id'],
                fields: {
                    _id: 'remote_id',
                    externalId: 'remote_id_alt',
                    name: 'name',
                    web: 'website',
                    phonePrimary: 'phone_number',
                    country: 'country',
                    city: 'city',
                    address: 'address',
                    zip: 'postal_code',
                    description: 'description',
                    createDate: 'remote_created_at',
                    lastUpdated: 'remote_updated_at',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { companyMapping };
