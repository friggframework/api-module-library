/**
 * DaySmart Vet clinic → canonical Company mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Company` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Company: https://docs.merge.dev/crm/companies/
 * - DaySmart Vet clinic: https://sandbox.vettersoftware.com/docs/
 *   (GET /api/1.0.0/{apiKey}/clinic → response.resource)
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        clinic: [
            {
                to: 'Company',
                identity: ['remote_id'],
                fields: {
                    apiKey: 'remote_id',
                    name: 'name',
                    email: 'email',
                    phone: 'phone_number',
                    website: 'website',
                    'addresses[0].address': 'address.street_1',
                    'addresses[0].city': 'address.city',
                    'addresses[0].state': 'address.state',
                    'addresses[0].zipcode': 'address.postal_code',
                    'addresses[0].country': 'address.country',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { companyMapping };
