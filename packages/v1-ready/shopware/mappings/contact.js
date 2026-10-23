/**
 * Shop-Ware customer → canonical Contact (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `business@1` schema
 * package does not exist yet. Field names follow a common CRM Contact shape
 * so a future registry can adopt this mapping near 1:1.
 *
 * Corporate customers expose `business_name`; that is carried as a custom
 * field rather than a separate Company mapping (Company would require a
 * distinct org identity that Shop-Ware does not always provide).
 *
 * Repair orders, vehicles, shops, and staff do not map cleanly onto
 * business@1 Company/Contact/Deal — they stay module-native.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - https://shop-ware.stoplight.io/docs/public-api/23e28f4750c54-get-a-specific-customer-by-id
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.business`).
 */

const contactMapping = {
    schema: 'business@1',
    validation: 'UNVALIDATED',
    objects: {
        customer: [
            {
                to: 'Contact',
                identity: ['externalIds.shopware', 'email', 'phone'],
                fields: {
                    email: 'email',
                    phone: 'phone_number',
                    first_name: 'first_name',
                    last_name: 'last_name',
                    business_name: 'company_name',
                    id: 'remote_id',
                },
                ops: ['read', 'create', 'update'],
            },
        ],
    },
};

module.exports = { contactMapping };
