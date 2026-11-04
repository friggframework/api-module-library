/**
 * Shopmonkey Company → canonical Company (business@1).
 *
 * Company records are returned by GET /company/{id} (and nested on /user/me).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://shopmonkey.dev/resources/company
 *   https://shopmonkey.dev/resources/user
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'Company',
                identity: ['externalIds.shopmonkey', 'name'],
                fields: {
                    id: 'id',
                    name: 'name',
                    createdDate: 'createdAt',
                },
                ops: ['read', 'update'],
            },
        ],
    },
};

module.exports = companyMapping;
