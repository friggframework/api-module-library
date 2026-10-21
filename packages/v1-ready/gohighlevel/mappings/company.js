/**
 * GoHighLevel Business → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Sources:
 *   https://marketplace.gohighlevel.com/docs/Authorization/Scopes (businesses.*)
 *   https://marketplace.gohighlevel.com/docs/ (Businesses API)
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        business: [
            {
                to: 'Company',
                identity: ['externalIds.gohighlevel', 'id'],
                fields: {
                    id: 'id',
                    name: 'name',
                    phone: 'phone',
                    email: 'email',
                    website: 'website',
                    address: 'address',
                    city: 'city',
                    state: 'state',
                    postalCode: 'postalCode',
                    country: 'country',
                    locationId: 'locationId',
                    createdAt: 'createdAt',
                    updatedAt: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = companyMapping;
