/**
 * Canonical mapping: PostHog Person → business@1 Contact.
 *
 * Labeled UNVALIDATED — field alignment is best-effort from PostHog's official
 * Persons API response shape. Top-level documented fields are `id`, `uuid`,
 * `name`, `distinct_ids`, `created_at`, `last_seen_at`. Email is a list filter
 * and available via `/persons/:id/emails/`, not a fixed top-level Person field
 * in the retrieve schema, so it is not mapped here. Not runtime-tested against
 * a live business@1 schema package.
 *
 * Sources:
 * - https://posthog.com/docs/api/persons
 * - ADR-057: docs/architecture-decisions/057-canonical-schema.md (frigg)
 */

const contactMapping = {
    schema: 'business@1',
    label: 'UNVALIDATED',
    objects: {
        person: [
            {
                to: 'Contact',
                identity: ['remote_id'],
                ops: ['read', 'update'],
                fields: {
                    // PostHog Person field → business@1 Contact field
                    uuid: 'remote_id',
                    name: 'displayName',
                    distinct_ids: 'external_ids',
                    created_at: 'createdAt',
                    last_seen_at: 'lastSeenAt',
                },
            },
        ],
    },
};

module.exports = { contactMapping };
