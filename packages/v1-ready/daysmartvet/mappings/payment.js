/**
 * DaySmart Vet payment → canonical Payment mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `billing@1` schema
 * package does not exist yet. Field names follow Merge Accounting `Payment`
 * so a future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge Accounting Payment: https://docs.merge.dev/accounting/payments/
 * - DaySmart Vet payments: https://sandbox.vettersoftware.com/docs/
 *   (GET /api/1.0.0/{apiKey}/payments — list only; no get-by-id in docs)
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.billing`).
 */

const paymentMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        payment: [
            {
                to: 'Payment',
                identity: ['remote_id'],
                fields: {
                    id: 'remote_id',
                    date: 'transaction_date',
                    'client.id': 'contact',
                    'payment_type.name': 'payment_method',
                    create_at: 'remote_created_at',
                    update_at: 'remote_updated_at',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { paymentMapping };
