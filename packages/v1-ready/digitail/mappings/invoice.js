/**
 * Digitail Invoice → canonical Invoice (billing@1).
 *
 * Status: UNVALIDATED — registry does not exist yet; field names are a
 * best-effort Stripe-shaped alignment per sibling billing modules.
 *
 * Sources:
 * - ADR-057
 * - https://documentation.digitail.io/list-all-invoices
 * - https://documentation.digitail.io/retrieve-an-invoice
 */

const invoiceMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        invoice: [
            {
                to: 'Invoice',
                identity: ['externalIds.digitail', 'id'],
                fields: {
                    id: 'id',
                    series: 'series',
                    number: 'number',
                    created_at: 'invoiceDate',
                    updated_at: 'updatedAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { invoiceMapping };
