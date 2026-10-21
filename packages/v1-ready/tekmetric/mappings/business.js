/**
 * Tekmetric → canonical business@1 (ADR-057).
 *
 * Shop → Company and Customer → Contact are the only objects that clearly fit
 * an existing canonical schema. Repair orders, jobs, vehicles, appointments,
 * and employees do not map cleanly onto Deal / support@1 / billing@1 without
 * inventing field semantics, so they are omitted (see PR open questions).
 *
 * Labeled UNVALIDATED until the Canonical Schema registry and Test Bench can
 * check field coverage.
 *
 * @see https://github.com/friggframework/frigg/blob/next/docs/architecture-decisions/057-canonical-schema.md
 */

const businessMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        shop: [
            {
                to: 'Company',
                identity: ['externalIds.tekmetric', 'id'],
                fields: {
                    id: 'id',
                    name: 'displayName',
                    nickname: 'nickname',
                    phone: 'phone',
                    email: 'email',
                    website: 'website',
                    'address.address1': 'billingAddress.line1',
                    'address.address2': 'billingAddress.line2',
                    'address.city': 'billingAddress.city',
                    'address.state': 'billingAddress.region',
                    'address.zip': 'billingAddress.postalCode',
                },
                ops: ['read'],
            },
        ],
        customer: [
            {
                to: 'Contact',
                identity: ['externalIds.tekmetric', 'id'],
                fields: {
                    id: 'id',
                    firstName: 'firstName',
                    lastName: 'lastName',
                    email: 'email',
                    'address.address1': 'address.line1',
                    'address.city': 'address.city',
                    'address.state': 'address.region',
                    'address.zip': 'address.postalCode',
                    shopId: 'companyExternalId',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { businessMapping };
