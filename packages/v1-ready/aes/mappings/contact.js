/**
 * AES Contributor → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Contributors are people (Patron, Attendee, Sponsor, Volunteer, Donor) with
 * person/contact fields documented in the ConductorLink guide (create sample)
 * and GetContributors return values. That is a genuine fit for business@1
 * Contact. Event, Package, Sale, and Payment do not map cleanly onto
 * Company / Contact / Deal / support@1 / billing@1 without stretching the
 * schemas, so they are omitted.
 *
 * Sources:
 *   https://help.aesauctions.com/article/3tz5rgz6lo-aes-conductor-link-api-guide
 *   https://help.aesauctions.com/article/otb8613u2y-aes-release-notes-version-6-0
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        contributor: [
            {
                to: 'Contact',
                identity: ['externalIds.aes', 'email'],
                fields: {
                    contributor_id: 'id',
                    first_name: 'firstName',
                    last_name: 'lastName',
                    email: 'email',
                    cell: 'phone',
                    phone: 'phone',
                    company: 'companyName',
                    address1: 'address',
                    city: 'city',
                    state: 'state',
                    zip: 'postalCode',
                    website: 'website',
                    title: 'title',
                },
                ops: ['read', 'create', 'update', 'delete'],
            },
        ],
    },
};

module.exports = contactMapping;
