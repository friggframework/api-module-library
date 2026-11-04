/**
 * DonorPerfect donor (individual) → canonical Contact (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://www.softerware.com/doclib/dp/manuals/dpo_sup_manual_xml_api_documentation.pdf
 *   (dp_savedonor / DP table fields)
 *
 * Condition: org_rec is not 'Y' (individual constituents). Organizational
 * donors map to Company — see mappings/company.js.
 */
const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        donor: [
            {
                when: { field: 'org_rec', notIn: ['Y'] },
                to: 'Contact',
                identity: ['externalIds.donorperfect', 'email'],
                fields: {
                    donor_id: 'id',
                    first_name: 'firstName',
                    last_name: 'lastName',
                    email: 'email',
                    home_phone: 'phone',
                    mobile_phone: 'mobilePhone',
                    business_phone: 'workPhone',
                    title: 'title',
                    address: 'address.street',
                    address2: 'address.street2',
                    city: 'address.city',
                    state: 'address.state',
                    zip: 'address.postalCode',
                    country: 'address.country',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = contactMapping;
