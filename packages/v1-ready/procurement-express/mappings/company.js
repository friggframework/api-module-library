/**
 * ProcurementExpress Supplier → canonical Company (business@1).
 *
 * Suppliers are vendor organizations — the closest fit to business@1 Company.
 * PE purchase orders / invoices do not map to Company/Contact/Deal; billing@1
 * and support@1 schemas are not published for this library yet, so those
 * objects are left unmapped (see PR open questions / ADR-057).
 *
 * Status: UNVALIDATED (ADR-057 draft; not checked against a published
 * @friggframework/canonical-schema-business package yet).
 *
 * Source: https://docs.procurementexpress.com/ (Suppliers)
 */
const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        supplier: [
            {
                to: 'Company',
                identity: ['externalIds.procurementExpress', 'id'],
                fields: {
                    id: 'id',
                    name: 'name',
                    email: 'email',
                    phone_number: 'phone',
                    address: 'address',
                    tax_number: 'taxId',
                    contact_person: 'description',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = companyMapping;
