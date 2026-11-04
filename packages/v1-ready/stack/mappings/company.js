/**
 * Stack Company → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057). Stack does not publish a public REST/OpenAPI
 * response schema for GET /integration/company. Field paths below are the
 * minimal identity surface an integration needs (id + display name) and must
 * be confirmed against a live partner response before production use.
 *
 * Sources (product context only — no official API schema):
 *   https://www.stackglobal.io/
 *   Ported partner path: GET /integration/company
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [
            {
                to: 'Company',
                identity: ['externalIds.stack', 'id'],
                fields: {
                    id: 'id',
                    companyId: 'id',
                    name: 'name',
                    display_name: 'displayName',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = companyMapping;
