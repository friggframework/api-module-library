/**
 * Aspire Invoice → canonical Invoice (billing@1).
 *
 * Status: UNVALIDATED (ADR-057 draft). External API exposes GET /Invoices only
 * (no create/update on the public Swagger surface).
 *
 * Sources:
 *   https://cloud-api.youraspire.com/swagger/v1/swagger.json
 *     (AspireCloud.Domain.Tenant.Invoices.ODataModel.Invoice)
 *   https://guide.youraspire.com/apidocs/invoices-2.md
 */
const invoiceMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        invoice: [
            {
                to: 'Invoice',
                identity: ['externalIds.aspire', 'InvoiceID'],
                fields: {
                    InvoiceID: 'id',
                    InvoiceNumberPrefix: 'number',
                    CompanyID: {
                        to: 'customer',
                        ref: 'business.Company',
                    },
                    Amount: 'total',
                    AmountRemaining: 'amountDue',
                    OrigAmount: 'subtotal',
                    InvoiceDate: 'invoiceDate',
                    DueDate: 'dueDate',
                    PaymentTermsName: 'paymentTerms',
                    LastModifiedDateTime: 'updatedAt',
                    CompletedDateTime: 'paidAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = invoiceMapping;
