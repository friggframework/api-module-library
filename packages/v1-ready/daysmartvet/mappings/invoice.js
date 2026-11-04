/**
 * DaySmart Vet invoice → canonical Invoice mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `billing@1` schema
 * package does not exist yet. Field names follow Merge Accounting `Invoice`
 * so a future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge Accounting Invoice: https://docs.merge.dev/accounting/invoices/
 * - DaySmart Vet invoices: https://sandbox.vettersoftware.com/docs/
 *   (GET /api/1.0.0/{apiKey}/invoices[/{invoiceId}])
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.billing`).
 */

const invoiceMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        invoice: [
            {
                to: 'Invoice',
                identity: ['remote_id'],
                fields: {
                    id: 'remote_id',
                    name: 'number',
                    status: 'status',
                    date: 'issue_date',
                    'client.id': 'contact',
                    'paymentTerm.label': 'payment_term',
                    createAt: 'remote_created_at',
                    updateAt: 'remote_updated_at',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { invoiceMapping };
