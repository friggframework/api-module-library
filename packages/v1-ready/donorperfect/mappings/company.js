/**
 * DonorPerfect donor (organization) → canonical Company (business@1).
 *
 * Status: UNVALIDATED (ADR-057 draft).
 *
 * Sources:
 *   https://www.softerware.com/doclib/dp/manuals/dpo_sup_manual_xml_api_documentation.pdf
 *   (dp_savedonor @org_rec='Y', @donor_type='CO')
 *
 * Condition: org_rec === 'Y'. Individuals map to Contact.
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        donor: [
            {
                when: { field: 'org_rec', in: ['Y'] },
                to: 'Company',
                identity: ['externalIds.donorperfect', 'email'],
                fields: {
                    donor_id: 'id',
                    last_name: 'name',
                    email: 'email',
                    business_phone: 'phone',
                    address: 'address.street',
                    address2: 'address.street2',
                    city: 'address.city',
                    state: 'address.state',
                    zip: 'address.postalCode',
                    country: 'address.country',
                    donor_type: 'type',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = companyMapping;
