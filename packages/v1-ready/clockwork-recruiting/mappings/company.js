/**
 * Clockwork Company → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Sources:
 *   https://api.clockworkrecruiting.com/v3.0 (developer docs via support)
 *   https://docs.stackone.com/connectors/clockwork (List/Get Company actions)
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'Company',
                identity: ['externalIds.clockwork-recruiting', 'id'],
                fields: {
                    id: 'id',
                    name: 'name',
                    do_not_contact: 'doNotContact',
                    is_client: 'isClient',
                    linkedin_url: 'linkedinUrl',
                    website: 'website',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = companyMapping;
