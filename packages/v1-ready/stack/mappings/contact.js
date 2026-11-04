/**
 * Stack company member → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057). Stack does not publish a public REST/OpenAPI
 * response schema for GET /integration/company/members. Field paths below are
 * a minimal person identity surface and must be confirmed against a live
 * partner response before production use.
 *
 * Sales-cycle objects are intentionally NOT mapped: a Stack sales cycle is a
 * process/playbook template, not a Deal/Opportunity instance (business@1 Deal).
 *
 * Sources (product context only — no official API schema):
 *   https://www.stackglobal.io/
 *   Ported partner path: GET /integration/company/members
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        member: [
            {
                to: 'Contact',
                identity: ['externalIds.stack', 'id'],
                fields: {
                    id: 'id',
                    email: 'email',
                    name: 'name',
                    first_name: 'firstName',
                    last_name: 'lastName',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = contactMapping;
