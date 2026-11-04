/**
 * ADR-057 canonical mapping: Vitally Account → business@1 Company.
 *
 * Source of truth:
 *   https://docs.vitally.io/en/articles/9880654-rest-api-accounts
 *
 * Status is UNVALIDATED until confirmed against a live Vitally sandbox.
 */
const companyMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        account: [
            {
                to: 'Company',
                identity: ['externalIds.vitally', 'externalId'],
                fields: {
                    name: 'displayName',
                    externalId: 'externalId',
                    mrr: 'mrr',
                    nextRenewalDate: 'renewalDate',
                    churnedAt: 'churnedAt',
                    organizationId: 'parentOrganizationId',
                    'traits.domain': 'domain',
                    'traits.website': 'website',
                    'traits.industry': 'industry',
                },
                ops: ['read', 'create', 'update'],
                notes:
                    'UNVALIDATED: maps Vitally Account fields/traits. Organizations are a separate hierarchy object (not Company).',
            },
        ],
    },
};

module.exports = { companyMapping };
