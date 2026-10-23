/**
 * PayJunction Invoice → canonical Invoice (billing@1).
 *
 * Status: UNVALIDATED — ADR-057 draft.
 *
 * Sources:
 * - ADR-057
 * - https://developer.payjunction.com/hc/en-us/articles/1260800369329-GET-invoices-invoiceId
 * - https://developer.payjunction.com/hc/en-us/articles/1260800368569-POST-invoices
 */

const invoiceMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        invoice: [
            {
                to: 'Invoice',
                identity: ['externalIds.payjunction', 'invoiceId'],
                fields: {
                    invoiceId: 'id',
                    invoiceNumber: 'number',
                    status: 'status',
                    amountBase: 'subtotal',
                    amountTotal: 'total',
                    amountSurcharge: 'surcharge',
                    customerEmail: 'customerEmail',
                    customerFirstName: 'customerGivenName',
                    customerLastName: 'customerFamilyName',
                    customerIdentifier: 'customerExternalId',
                    terminalId: 'locationId',
                    transactionId: 'paymentId',
                    hostedInvoiceUrl: 'hostedUrl',
                    created: 'createdAt',
                    lastModified: 'updatedAt',
                    completedAt: 'paidAt',
                },
                ops: ['read', 'create'],
            },
        ],
    },
};

module.exports = invoiceMapping;
