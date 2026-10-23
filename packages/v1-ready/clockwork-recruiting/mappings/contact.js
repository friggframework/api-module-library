/**
 * Clockwork Person → canonical Contact (business@1).
 *
 * People in Clockwork are candidates and contacts in the firm database.
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Deal mapping is intentionally omitted: search Projects / Candidacies are
 * engagement pipeline objects, not CRM opportunities with amount/stage/win-loss.
 *
 * Sources:
 *   https://api.clockworkrecruiting.com/v3.0 (developer docs via support)
 *   https://docs.stackone.com/connectors/clockwork (People actions)
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        person: [
            {
                to: 'Contact',
                identity: ['externalIds.clockwork-recruiting', 'id'],
                fields: {
                    id: 'id',
                    first_name: 'firstName',
                    last_name: 'lastName',
                    name: 'name',
                    biography: 'description',
                    linkedin_url: 'linkedinUrl',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'delete'],
            },
        ],
    },
};

module.exports = contactMapping;
