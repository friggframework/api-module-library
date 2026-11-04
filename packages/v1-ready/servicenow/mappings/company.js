/**
 * ServiceNow Company / CSM Account → canonical business mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow Merge CRM Company / ADR-057
 * Customer-style display fields so a future registry can adopt this near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge CRM Company: https://docs.merge.dev/crm/companies/
 * - core_company form fields: https://www.servicenow.com/docs/r/platform-administration/user-administration/t_AddANewCompany.html
 * - customer_account (CSM B2B): https://www.servicenow.com/docs/r/customer-service-management/b2b-account-data-model.html
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const companyObjectMapping = {
    to: 'Company',
    identity: ['remote_id'],
    fields: {
        sys_id: 'remote_id',
        name: 'name',
        phone: 'phone_number',
        fax_phone: 'fax',
        street: 'address_street_1',
        city: 'address_city',
        state: 'address_state',
        zip: 'address_postal_code',
        stock_symbol: 'ticker',
        notes: 'description',
        sys_created_on: 'remote_created_at',
        sys_updated_on: 'remote_updated_at',
    },
    ops: ['read'],
};

const companyMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        company: [companyObjectMapping],
        customer_account: [
            {
                ...companyObjectMapping,
                to: 'Company',
            },
        ],
    },
};

module.exports = { companyMapping };
