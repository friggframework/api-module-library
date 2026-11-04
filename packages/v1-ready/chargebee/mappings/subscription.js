/**
 * Chargebee Subscription → canonical Subscription (billing@1).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `billing@1` schema
 * package does not exist yet. Field names follow a Stripe-shaped Subscription
 * common model (id, customer, status, period bounds, currency) so a future
 * registry can adopt this mapping near 1:1. `customer_id` references
 * `business.Company` (Chargebee Customer ≈ billing company/account).
 *
 * Do not compute MRR/LTV in this module — leave derived metrics to consumers.
 *
 * Sources:
 * - ADR-057: https://github.com/friggframework/frigg/blob/next/docs/architecture-decisions/057-canonical-schema.md
 * - Chargebee Subscription:
 *   https://apidocs.chargebee.com/docs/api/subscriptions?prod_cat_ver=2
 * - Official OpenAPI schema `Subscription` in
 *   chargebee/openapi spec/chargebee_api_v2_pc_v2_spec.yaml
 */

const subscriptionMapping = {
    schema: 'billing@1',
    validation: 'UNVALIDATED',
    objects: {
        subscription: [
            {
                to: 'Subscription',
                identity: ['externalIds.chargebee', 'id'],
                fields: {
                    id: 'id',
                    customer_id: {
                        to: 'customer',
                        // Chargebee Customer maps to business.Company
                        ref: 'business.Company',
                    },
                    status: 'status',
                    currency_code: 'currency',
                    current_term_start: 'currentPeriodStart',
                    current_term_end: 'currentPeriodEnd',
                    trial_start: 'trialStart',
                    trial_end: 'trialEnd',
                    start_date: 'startDate',
                    started_at: 'startedAt',
                    activated_at: 'activatedAt',
                    cancelled_at: 'canceledAt',
                    cancel_reason: 'cancellationReason',
                    next_billing_at: 'nextBillingAt',
                    billing_period: 'billingPeriod',
                    billing_period_unit: 'billingPeriodUnit',
                    created_at: 'createdAt',
                    updated_at: 'updatedAt',
                },
                ops: ['read'],
            },
        ],
    },
};

module.exports = { subscriptionMapping };
