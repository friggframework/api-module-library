/**
 * Close Contact → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://developer.close.com/api/resources/contacts.md
 *   https://api.close.com/api/openapi.json (Contact schema)
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        contact: [
            {
                to: 'Contact',
                identity: ['externalIds.close', 'emails[0].email'],
                fields: {
                    id: 'id',
                    name: 'name',
                    display_name: 'displayName',
                    title: 'title',
                    'emails[0].email': 'email',
                    'phones[0].phone': 'phone',
                    lead_id: 'companyId',
                    timezone: 'timezone',
                    date_created: 'createdAt',
                    date_updated: 'updatedAt',
                    organization_id: 'organizationId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = contactMapping;
