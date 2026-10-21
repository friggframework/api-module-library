/**
 * PayJunction Transaction → canonical Payment (billing@1).
 *
 * PayJunction's money-movement resource is Transaction (CHARGE / REFUND /
 * VERIFY). Mapped to a Stripe-shaped Payment under billing@1.
 *
 * Status: UNVALIDATED — ADR-057 draft.
 *
 * Sources:
 * - ADR-057
 * - https://developer.payjunction.com/hc/en-us/articles/1260802694490-GET-transactions-query-parameters
 * - https://developer.payjunction.com/hc/en-us/articles/216477407-POST-transactions
 */

const paymentMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        transaction: [
            {
                to: 'Payment',
                identity: ['externalIds.payjunction', 'transactionId'],
                fields: {
                    transactionId: 'id',
                    action: 'type',
                    status: 'status',
                    amountBase: 'amount',
                    amountTotal: 'amountTotal',
                    amountTax: 'tax',
                    terminalId: 'locationId',
                    settlementId: 'settlementId',
                    invoiceNumber: 'invoiceNumber',
                    billingFirstName: 'billingGivenName',
                    billingLastName: 'billingFamilyName',
                    billingIdentifier: 'customerExternalId',
                    created: 'createdAt',
                    lastModified: 'updatedAt',
                },
                ops: ['read', 'create'],
            },
        ],
    },
};

module.exports = paymentMapping;
