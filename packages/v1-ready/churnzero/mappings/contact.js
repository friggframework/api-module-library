/**
 * ChurnZero Contact → canonical Contact mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM `Contact` so a
 * future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Contact: https://docs.merge.dev/crm/contacts/
 * - ChurnZero Contact: https://app.churnzero.net/developers
 *   (official OpenAPI schema ChurnZero.Contact)
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
                    Id: 'remote_id',
                    ExternalId: 'remote_id_alt',
                    Email: 'email',
                    FirstName: 'first_name',
                    LastName: 'last_name',
                    FullName: 'name',
                    Name: 'name',
                    AccountId: 'account',
                    ObjectCreatedDate: 'remote_created_at',
                    ObjectLastModifiedDate: 'remote_updated_at',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { contactMapping };
