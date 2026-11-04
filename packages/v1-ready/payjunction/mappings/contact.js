/**
 * PayJunction Customer → canonical Contact (business@1).
 *
 * Status: UNVALIDATED — ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet.
 *
 * Customers with `companyName` may also be treated as Company by consumers;
 * this mapping covers the person-shaped fields documented on GET /customers.
 *
 * Sources:
 * - ADR-057
 * - https://developer.payjunction.com/hc/en-us/articles/232222208-GET-customers-query-parameters
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        customer: [
            {
                to: 'Contact',
                identity: ['externalIds.payjunction', 'customerId'],
                fields: {
                    customerId: 'id',
                    firstName: 'givenName',
                    lastName: 'familyName',
                    companyName: 'companyName',
                    identifier: 'externalId',
                    email: 'email',
                    created: 'createdAt',
                    lastModified: 'updatedAt',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = contactMapping;
