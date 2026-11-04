/**
 * DrChrono Patient → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Patients are clinical person records with person-shaped fields (name, email,
 * phone). That is a genuine Contact fit; appointments / line items / offices
 * do not map cleanly onto Deal / Company / Invoice without stretching the
 * schema, so they are omitted.
 *
 * Sources:
 *   https://app.drchrono.com/api-docs/v2/documentation (patients_read / patients_create)
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        patient: [
            {
                to: 'Contact',
                identity: ['externalIds.drchrono', 'email'],
                fields: {
                    id: 'id',
                    first_name: 'firstName',
                    last_name: 'lastName',
                    email: 'email',
                    cell_phone: 'phone',
                    home_phone: 'homePhone',
                    date_of_birth: 'birthDate',
                    gender: 'gender',
                    doctor: 'ownerId',
                    chart_id: 'displayId',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = contactMapping;
