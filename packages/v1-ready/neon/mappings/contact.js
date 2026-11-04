/**
 * Neon individual Account → canonical Contact (business@1).
 *
 * Neon "accounts" are constituents. Individual accounts map to Contact;
 * organization accounts map to Company (see company.js).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.neoncrm.com/accounts/
 *   https://developer.neoncrm.com/api-v2/
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        account: [
            {
                to: 'Contact',
                when: { accountType: 'INDIVIDUAL' },
                identity: ['externalIds.neon', 'primaryContact.email1'],
                fields: {
                    accountId: 'id',
                    'primaryContact.firstName': 'firstName',
                    'primaryContact.lastName': 'lastName',
                    'primaryContact.email1': 'email',
                    'primaryContact.phone1': 'phone',
                    'primaryContact.addresses[0]': 'address',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = contactMapping;
