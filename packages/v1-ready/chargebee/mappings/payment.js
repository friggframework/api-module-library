/**
 * Chargebee Transaction → canonical Payment (billing@1).
 *
 * Chargebee's payment/money-movement resource is Transaction (type payment /
 * refund / authorization / …). Mapped to Stripe-shaped Payment.
 *
 * Status: UNVALIDATED — see mappings/subscription.js.
 * `customer_id` references `business.Company`.
 *
 * Sources:
 * - ADR-057
 * - https://apidocs.chargebee.com/docs/api/transactions?prod_cat_ver=2
 * - Official OpenAPI schema `Transaction`
 */

const paymentMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        transaction: [
            {
                to: 'Payment',
                identity: ['externalIds.chargebee', 'id'],
                fields: {
                    id: 'id',
                    customer_id: {
                        to: 'customer',
                        ref: 'business.Company',
                    },
                    subscription_id: 'subscription',
                    type: 'type',
                    status: 'status',
                    amount: 'amount',
                    currency_code: 'currency',
                    payment_method: 'paymentMethod',
                    gateway: 'gateway',
                    id_at_gateway: 'gatewayTransactionId',
                    reference_number: 'referenceNumber',
                    date: 'createdAt',
                    settled_at: 'settledAt',
                    voided_at: 'voidedAt',
                    error_code: 'errorCode',
                    error_text: 'errorMessage',
                    updated_at: 'updatedAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { paymentMapping };
