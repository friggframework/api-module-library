/**
 * Freshdesk Ticket → canonical Ticket mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `support@1` schema
 * package does not exist yet. Field names follow the Merge Ticketing `Ticket`
 * common model so a future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge Ticketing Ticket: https://docs.merge.dev/ticketing/tickets/
 * - Freshdesk Ticket fields: https://developers.freshdesk.com/api/#tickets
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.support`).
 */

const ticketMapping = {
    schema: 'support@1',
    // Explicit until `@friggframework/canonical-schema-support` (or equivalent)
    // ships and `validateCanonicalMapping()` can run against a real registry.
    validation: 'UNVALIDATED',
    objects: {
        ticket: [
            {
                to: 'Ticket',
                identity: ['remote_id'],
                fields: {
                    // Freshdesk field → Merge Ticketing Ticket field
                    id: 'remote_id',
                    subject: 'name',
                    description_text: 'description',
                    description: 'description_html',
                    status: {
                        to: 'status',
                        transform: 'freshdeskStatusToMerge',
                    },
                    priority: {
                        to: 'priority',
                        transform: 'freshdeskPriorityToMerge',
                    },
                    type: 'ticket_type',
                    responder_id: {
                        to: 'assignees',
                        transform: 'freshdeskIdToSingletonArray',
                    },
                    group_id: {
                        to: 'assigned_teams',
                        transform: 'freshdeskIdToSingletonArray',
                    },
                    requester_id: 'contact',
                    company_id: 'account',
                    tags: 'tags',
                    created_at: 'remote_created_at',
                    updated_at: 'remote_updated_at',
                    due_by: 'due_date',
                },
                // Informational only; ADR-045 traits are authoritative when present.
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { ticketMapping };
