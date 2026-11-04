/**
 * GoHighLevel Contact → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://marketplace.gohighlevel.com/docs/ghl/contacts/get-contact
 *   https://marketplace.gohighlevel.com/docs/ghl/contacts/create-contact
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        contact: [
            {
                to: 'Contact',
                identity: ['externalIds.gohighlevel', 'email'],
                fields: {
                    id: 'id',
                    name: 'name',
                    firstName: 'firstName',
                    lastName: 'lastName',
                    email: 'email',
                    phone: 'phone',
                    companyName: 'companyName',
                    address1: 'address',
                    city: 'city',
                    state: 'state',
                    postalCode: 'postalCode',
                    country: 'country',
                    website: 'website',
                    timezone: 'timezone',
                    locationId: 'locationId',
                    assignedTo: 'ownerId',
                    dateAdded: 'createdAt',
                    dateUpdated: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = contactMapping;
