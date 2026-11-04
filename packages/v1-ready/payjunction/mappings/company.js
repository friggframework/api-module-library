/**
 * PayJunction Merchant → canonical Company (business@1).
 *
 * Status: UNVALIDATED — ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet.
 *
 * Sources:
 * - ADR-057 (frigg docs/architecture-decisions/057-canonical-schema.md)
 * - https://developer.payjunction.com/hc/en-us/articles/12090782110619-GET-merchant
 */

const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        merchant: [
            {
                to: 'Company',
                identity: ['externalIds.payjunction', 'id'],
                fields: {
                    id: 'id',
                    companyDba: 'displayName',
                    companyLegal: 'legalName',
                    phone1: 'phone',
                    'address.address': 'address.line1',
                    'address.city': 'address.locality',
                    'address.state': 'address.region',
                    'address.zip': 'address.postalCode',
                    'address.country': 'address.country',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = companyMapping;
