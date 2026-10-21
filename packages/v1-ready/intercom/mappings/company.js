/**
 * Intercom Company → canonical Company mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Company` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Company: https://docs.merge.dev/crm/companies/
 * - Intercom Company: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/companies/retrieveacompanybyid
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
                    id: 'remote_id',
                    company_id: 'remote_id_alt',
                    name: 'name',
                    website: 'website',
                    industry: 'industry',
                    size: 'number_of_employees',
                    created_at: {
                        to: 'remote_created_at',
                        transform: 'intercomUnixToIso',
                    },
                    updated_at: {
                        to: 'remote_updated_at',
                        transform: 'intercomUnixToIso',
                    },
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { companyMapping };
