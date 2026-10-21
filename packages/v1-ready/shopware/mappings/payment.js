/**
 * Shop-Ware payment → canonical Payment (ADR-057 / billing@1).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `billing@1` schema
 * package does not exist yet.
 *
 * Shop-Ware Partner API v1 exposes read-only payment list/get (no create).
 * Amounts are integer cents (`amount_cents`).
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Official OpenAPI: https://api.shop-ware.com/api-docs/public/v1/swagger.yaml
 *   paths `/api/v1/tenants/{tenant_id}/payments`
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
                identity: ['externalIds.shopware'],
                fields: {
                    id: 'remote_id',
                    amount_cents: 'amount_cents',
                    payment_type: 'method',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { paymentMapping };
