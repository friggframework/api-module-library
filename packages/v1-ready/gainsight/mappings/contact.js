/**
 * Gainsight Person → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Person_API/People_API_Documentation
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        person: [
            {
                to: 'Contact',
                identity: ['externalIds.gainsight', 'Email'],
                fields: {
                    gsid: 'id',
                    Email: 'email',
                    email: 'email',
                    FirstName: 'firstName',
                    firstname: 'firstName',
                    LastName: 'lastName',
                    lastname: 'lastName',
                    Name: 'name',
                    name: 'name',
                    Title: 'title',
                    title: 'title',
                    Location: 'location',
                    location: 'location',
                    Timezone: 'timezone',
                    timezone: 'timezone',
                    LinkedinUrl: 'linkedinUrl',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = contactMapping;
