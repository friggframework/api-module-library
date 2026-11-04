/**
 * Digitail PetParent → canonical Contact (business@1).
 *
 * Status: UNVALIDATED — ADR-057 draft. PetParent is Digitail's preferred term
 * for the pet owner / client person record (name, email, phone, address).
 *
 * Sources:
 * - ADR-057
 * - https://documentation.digitail.io/list-all-petparents
 * - https://documentation.digitail.io/create-a-petparent
 */

const petParentMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        petParent: [
            {
                to: 'Contact',
                identity: ['externalIds.digitail', 'id'],
                fields: {
                    id: 'id',
                    name: 'firstName',
                    last_name: 'lastName',
                    email: 'email',
                    phone: 'phone',
                    secondary_phone: 'mobilePhone',
                    address: 'address',
                    city: 'city',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { petParentMapping };
