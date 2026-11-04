/**
 * Attentive subscriber / user identifiers → canonical Contact (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow common CRM Contact shape so a
 * future registry can adopt this mapping near 1:1.
 *
 * Attentive has no list-all-subscribers REST endpoint; subscribers are addressed
 * by phone and/or email on GET /subscriptions and GET /attributes/custom, and
 * created/updated via POST /subscriptions and POST /attributes/custom.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - https://docs.attentive.com/reference/getsubscriptions
 * - https://docs.attentive.com/reference/addsubscriptions
 * - https://docs.attentive.com/reference/getcustomattributes
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        // Provider object key: subscriber (Attentive's term for a marketed user).
        subscriber: [
            {
                to: 'Contact',
                identity: ['externalIds.attentive', 'email', 'phone'],
                fields: {
                    email: 'email',
                    phone: 'phone_number',
                    'externalIdentifiers.clientUserId': 'remote_id',
                    // Custom attributes are free-form name/value pairs —
                    // consumers should project named attributes as needed.
                    customAttributes: 'custom_fields',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { contactMapping };
