/**
 * ADR-057 canonical mapping: Segment Unify *account* (group) profiles →
 * business@1 Company.
 *
 * Source of truth:
 *   https://www.twilio.com/docs/segment/unify/profile-api
 *   GET .../collections/accounts/profiles/group_id:{id}/traits
 *
 * Account-level profiles carry group/account traits from the Segment Spec
 * `group` call. Status is UNVALIDATED until confirmed against a live space.
 */
const companyMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        account_profile: [
            {
                to: 'Company',
                identity: ['externalIds.segment', 'domain'],
                fields: {
                    'traits.name': 'displayName',
                    'traits.industry': 'industry',
                    'traits.employee_count': 'employeeCount',
                    'traits.website': 'website',
                    'traits.domain': 'domain',
                    'traits.plan': 'plan',
                },
                ops: ['read'],
                notes:
                    'UNVALIDATED: maps Profile API account/group traits per Unify account collections.',
            },
        ],
    },
};

module.exports = { companyMapping };
