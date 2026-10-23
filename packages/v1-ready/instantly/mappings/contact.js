/**
 * ADR-057 canonical mapping: Instantly Lead → business@1 Contact.
 *
 * Source of truth (vendor OpenAPI Lead schema):
 *   https://api.instantly.ai/openapi/api_v2.json
 *   https://developer.instantly.ai/api-reference/lead/get-lead
 *
 * Status is UNVALIDATED until confirmed against a live Instantly sandbox.
 */
const contactMapping = {
    schema: 'business@1',
    status: 'UNVALIDATED',
    objects: {
        lead: [
            {
                to: 'Contact',
                identity: ['externalIds.instantly', 'email', 'id'],
                fields: {
                    email: 'email',
                    first_name: 'firstName',
                    last_name: 'lastName',
                    phone: 'phone',
                    job_title: 'title',
                    company_name: 'companyName',
                    company_domain: 'companyDomain',
                    website: 'website',
                    id: 'externalId',
                },
                ops: ['read', 'create', 'update'],
                notes:
                    'UNVALIDATED: Instantly Lead is the outreach contact record. company_name/company_domain are lead attributes, not a first-class Company object.',
            },
        ],
    },
};

module.exports = { contactMapping };
