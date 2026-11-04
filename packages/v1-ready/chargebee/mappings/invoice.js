/**
 * Chargebee Invoice → canonical Invoice (billing@1).
 *
 * Status: UNVALIDATED — see mappings/subscription.js. Stripe-shaped Invoice
 * fields; `customer_id` references `business.Company`.
 *
 * Sources:
 * - ADR-057
 * - https://apidocs.chargebee.com/docs/api/invoices?prod_cat_ver=2
 * - Official OpenAPI schema `Invoice`
 */

const invoiceMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        invoice: [
            {
                to: 'Invoice',
                identity: ['externalIds.chargebee', 'id'],
                fields: {
                    id: 'id',
                    customer_id: {
                        to: 'customer',
                        ref: 'business.Company',
                    },
                    subscription_id: 'subscription',
                    status: 'status',
                    currency_code: 'currency',
                    total: 'total',
                    sub_total: 'subtotal',
                    amount_due: 'amountDue',
                    amount_paid: 'amountPaid',
                    amount_adjusted: 'amountAdjusted',
                    tax: 'tax',
                    date: 'invoiceDate',
                    due_date: 'dueDate',
                    paid_at: 'paidAt',
                    voided_at: 'voidedAt',
                    recurring: 'recurring',
                    first_invoice: 'firstInvoice',
                    generated_at: 'generatedAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { invoiceMapping };
