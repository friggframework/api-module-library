/**
 * Shopmonkey Customer → canonical Contact (business@1).
 *
 * Customers are shop clients (people/businesses bringing vehicles in), with
 * email/phone/name fields — a genuine Contact fit under business@1.
 *
 * Orders (work orders) are intentionally NOT mapped to Deal: they represent
 * repair jobs, not CRM pipeline opportunities.
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://shopmonkey.dev/resources/customer
 *   https://shopmonkey.dev/schema/Customer
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        customer: [
            {
                to: 'Contact',
                identity: ['externalIds.shopmonkey', 'email'],
                fields: {
                    id: 'id',
                    firstName: 'firstName',
                    lastName: 'lastName',
                    companyName: 'companyName',
                    createdDate: 'createdAt',
                    updatedDate: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'delete'],
            },
        ],
    },
};

module.exports = contactMapping;
