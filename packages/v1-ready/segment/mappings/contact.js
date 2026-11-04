/**
 * ADR-057 canonical mapping: Segment Unify *user* profiles → business@1 Contact.
 *
 * Source of truth for profile shape:
 *   https://www.twilio.com/docs/segment/unify/profile-api
 *   GET .../collections/users/profiles/{id_type:value}/traits
 *
 * Traits are an open map (first_name, email, ...). Field paths below are the
 * conventional Segment Spec identify traits; status is UNVALIDATED until a
 * sandbox Unify space confirms coverage.
 */
const contactMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        user_profile: [
            {
                to: 'Contact',
                identity: ['externalIds.segment', 'email'],
                fields: {
                    'traits.email': 'email',
                    'traits.first_name': 'givenName',
                    'traits.last_name': 'familyName',
                    'traits.name': 'displayName',
                    'traits.phone': 'phone',
                    'traits.title': 'title',
                },
                ops: ['read'],
                notes:
                    'UNVALIDATED: maps Profile API user traits. Group/account traits belong in company.js.',
            },
        ],
    },
};

module.exports = { contactMapping };
