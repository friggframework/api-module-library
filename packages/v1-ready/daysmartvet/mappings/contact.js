/**
 * DaySmart Vet client (pet owner) → canonical Contact mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Contact` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Contact: https://docs.merge.dev/crm/contacts/
 * - DaySmart Vet clients: https://sandbox.vettersoftware.com/docs/
 *   (GET/POST/PUT /api/1.0.0/{apiKey}/clients[/{clientId}])
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        client: [
            {
                to: 'Contact',
                identity: ['remote_id', 'email'],
                fields: {
                    id: 'remote_id',
                    email: 'email',
                    firstName: 'first_name',
                    lastName: 'last_name',
                    mobile: 'phone_number',
                    home: 'phone_numbers.home',
                    work: 'phone_numbers.work',
                    address: 'address.street_1',
                    city: 'address.city',
                    state: 'address.state',
                    zipcode: 'address.postal_code',
                    country: 'address.country',
                    createAt: 'remote_created_at',
                    updateAt: 'remote_updated_at',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { contactMapping };
