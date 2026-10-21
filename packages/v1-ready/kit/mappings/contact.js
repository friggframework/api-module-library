/**
 * Kit subscriber → canonical Contact (business@1).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet (ADR-057). Field names follow a common CRM
 * Contact shape so a future registry can adopt this mapping near 1:1.
 *
 * Kit is an email-marketing platform. Subscribers are the primary person
 * object (email, first_name, state, custom fields). There is no native
 * Company or Deal object that fits business@1 without inventing structure —
 * those mappings are intentionally omitted.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - https://developers.kit.com/api-reference/subscribers/list-subscribers
 * - https://developers.kit.com/api-reference/subscribers/get-a-subscriber
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        subscriber: [
            {
                to: 'Contact',
                identity: ['externalIds.kit', 'email'],
                fields: {
                    id: 'id',
                    email_address: 'email',
                    first_name: 'firstName',
                    state: 'status',
                    created_at: 'createdAt',
                    fields: 'custom_fields',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { contactMapping };
