/**
 * Planhat Enduser → canonical Contact mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Contact` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Contact: https://docs.merge.dev/crm/contacts/
 * - Planhat Enduser: https://www.planhat.com/developers/api/enduser
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        enduser: [
            {
                to: 'Contact',
                identity: ['remote_id', 'email'],
                fields: {
                    _id: 'remote_id',
                    externalId: 'remote_id_alt',
                    email: 'email',
                    firstName: 'first_name',
                    lastName: 'last_name',
                    name: 'name',
                    phone: 'phone_number',
                    position: 'title',
                    companyId: 'company_remote_id',
                    createDate: 'remote_created_at',
                    updatedAt: 'remote_updated_at',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { contactMapping };
