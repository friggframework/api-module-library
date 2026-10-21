/**
 * Totango User → canonical Contact (business@1).
 *
 * End-users on accounts are returned by POST /api/v1/search/users.
 * User id appears as `name` (often an email); `display_name` is the label.
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://support.totango.com/hc/en-us/articles/204174135-Search-API-accounts-and-users
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        user: [
            {
                to: 'Contact',
                identity: ['externalIds.totango', 'name'],
                fields: {
                    name: 'id',
                    display_name: 'displayName',
                    first_activity_time: 'createdAt',
                    last_activity_time: 'lastActivityAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = contactMapping;
