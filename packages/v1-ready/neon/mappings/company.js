/**
 * Neon organization Account → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.neoncrm.com/accounts/
 *   https://developer.neoncrm.com/api-v2/
 *
 * Deal / billing / support canonicals are skipped: Neon donations, pledges,
 * and memberships are fundraising/membership objects, not sales opportunities
 * or invoices, and Neon has no ticket model in the curated surface.
 */

const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        account: [
            {
                to: 'Company',
                when: { accountType: 'ORGANIZATION' },
                identity: ['externalIds.neon', 'organizationName'],
                fields: {
                    accountId: 'id',
                    organizationName: 'name',
                    'primaryContact.email1': 'email',
                    'primaryContact.addresses[0]': 'address',
                    website: 'website',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = companyMapping;
