/**
 * ADR-057 canonical mapping: Vitally User → business@1 Contact.
 *
 * Source of truth:
 *   https://docs.vitally.io/en/articles/9880661-rest-api-users
 *
 * Status is UNVALIDATED until confirmed against a live Vitally sandbox.
 */
const contactMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        user: [
            {
                to: 'Contact',
                identity: ['externalIds.vitally', 'email', 'externalId'],
                fields: {
                    email: 'email',
                    name: 'displayName',
                    externalId: 'externalId',
                    avatar: 'avatarUrl',
                    'traits.title': 'title',
                    'traits.phone': 'phone',
                    npsLastScore: 'npsScore',
                },
                ops: ['read', 'create', 'update'],
                notes:
                    'UNVALIDATED: maps Vitally User fields/traits. Account associations are relations, not Contact fields.',
            },
        ],
    },
};

module.exports = { contactMapping };
