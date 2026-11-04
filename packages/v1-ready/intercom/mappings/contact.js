/**
 * Intercom Contact → canonical Contact mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Contact` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Contact: https://docs.merge.dev/crm/contacts/
 * - Intercom Contact: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/contacts/showcontact
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        contact: [
            {
                to: 'Contact',
                identity: ['remote_id', 'email'],
                fields: {
                    id: 'remote_id',
                    external_id: 'remote_id_alt',
                    name: 'name',
                    email: 'email',
                    phone: 'phone_number',
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

module.exports = { contactMapping };
