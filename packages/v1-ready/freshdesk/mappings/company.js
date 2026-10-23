/**
 * Freshdesk Company → canonical Company mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Company` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Company: https://docs.merge.dev/crm/companies/
 * - Freshdesk Company: https://developers.freshdesk.com/api/#companies
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
                    name: 'name',
                    description: 'description',
                    domains: 'domains',
                    industry: 'industry',
                    created_at: 'remote_created_at',
                    updated_at: 'remote_updated_at',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { companyMapping };
