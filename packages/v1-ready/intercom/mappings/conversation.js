/**
 * Intercom Conversation → canonical Ticket mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `support@1` schema
 * package does not exist yet. Field names follow the Merge Ticketing `Ticket`
 * common model so a future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge Ticketing Ticket: https://docs.merge.dev/ticketing/tickets/
 * - Intercom Conversation: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/retrieveconversation
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.support`).
 */

const conversationMapping = {
    schema: 'support@1',
    // Explicit until `@friggframework/canonical-schema-support` (or equivalent)
    // ships and `validateCanonicalMapping()` can run against a real registry.
    validation: 'UNVALIDATED',
    objects: {
        conversation: [
            {
                to: 'Ticket',
                identity: ['remote_id'],
                fields: {
                    // Intercom field → Merge Ticketing Ticket field
                    id: 'remote_id',
                    title: 'name',
                    state: {
                        to: 'status',
                        transform: 'intercomConversationStateToMerge',
                    },
                    priority: {
                        to: 'priority',
                        transform: 'intercomPriorityToMerge',
                    },
                    admin_assignee_id: {
                        to: 'assignees',
                        transform: 'intercomIdToSingletonArray',
                    },
                    team_assignee_id: {
                        to: 'assigned_teams',
                        transform: 'intercomIdToSingletonArray',
                    },
                    // Primary contact id when contacts.contacts[0].id is present
                    // is applied by transform from the contacts object shape.
                    contacts: {
                        to: 'contact',
                        transform: 'intercomContactsToPrimaryId',
                    },
                    created_at: {
                        to: 'remote_created_at',
                        transform: 'intercomUnixToIso',
                    },
                    updated_at: {
                        to: 'remote_updated_at',
                        transform: 'intercomUnixToIso',
                    },
                },
                // Informational only; ADR-045 traits are authoritative when present.
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { conversationMapping };
