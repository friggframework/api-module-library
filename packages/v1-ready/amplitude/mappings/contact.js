/**
 * Canonical mapping: Amplitude User Profile → business@1 Contact.
 *
 * Labeled UNVALIDATED — field alignment is best-effort from Amplitude's
 * official User Profile API response shape. Amplitude `amp_props` is a
 * free-form user-properties map (no fixed email/name keys in the docs), so
 * only top-level identity fields from the documented `userData` envelope are
 * mapped here. Not runtime-tested against a live business@1 schema package.
 *
 * Sources:
 * - https://amplitude.com/docs/apis/analytics/user-profile
 * - ADR-057: docs/architecture-decisions/057-canonical-schema.md (frigg)
 */

const contactMapping = {
    schema: 'business@1',
    label: 'UNVALIDATED',
    objects: {
        user_profile: [
            {
                to: 'Contact',
                identity: ['remote_id'],
                ops: ['read'],
                fields: {
                    // Amplitude userData field → business@1 Contact field
                    user_id: 'remote_id',
                    device_id: 'device_id',
                    // amp_props: free-form map (library, first_used, …) — no
                    // stable email/displayName keys are documented; leave to
                    // named transforms / adopter overlays.
                    cohort_ids: 'cohort_ids',
                },
            },
        ],
    },
};

module.exports = { contactMapping };
