/**
 * Digitail Clinic → canonical Company (business@1).
 *
 * Status: UNVALIDATED — ADR-057 draft; clinic is the practice/org identity
 * returned by GET /clinics and nested under GET /auth/me?include[]=clinic.
 *
 * Sources:
 * - ADR-057 (frigg docs/architecture-decisions/057-canonical-schema.md)
 * - https://documentation.digitail.io/get-clinics-list-by-ids
 * - https://documentation.digitail.io/get-the-logged-in-user-vet
 */

const clinicMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        clinic: [
            {
                to: 'Company',
                identity: ['externalIds.digitail', 'id'],
                fields: {
                    id: 'id',
                    name: 'name',
                    logo: 'logoUrl',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { clinicMapping };
