/**
 * Close Lead → canonical Company (business@1).
 *
 * In Close, Leads are companies/organizations (primary CRM object).
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Sources:
 *   https://developer.close.com/api/resources/leads.md
 *   https://api.close.com/api/openapi.json (Lead schema)
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        lead: [
            {
                to: 'Company',
                identity: ['externalIds.close', 'id'],
                fields: {
                    id: 'id',
                    name: 'name',
                    display_name: 'displayName',
                    url: 'website',
                    description: 'description',
                    status_label: 'status',
                    status_id: 'statusId',
                    primary_email: 'email',
                    'addresses[0]': 'address',
                    date_created: 'createdAt',
                    date_updated: 'updatedAt',
                    organization_id: 'organizationId',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = companyMapping;
