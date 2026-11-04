/**
 * Intercom Ticket → canonical Ticket mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `support@1` schema
 * package does not exist yet. Field names follow the Merge Ticketing `Ticket`
 * common model so a future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge Ticketing Ticket: https://docs.merge.dev/ticketing/tickets/
 * - Intercom Ticket: https://developers.intercom.com/docs/references/rest-api/api.intercom.io/tickets/getticket
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.support`).
 */

const ticketMapping = {
    schema: 'support@1',
    validation: 'UNVALIDATED',
    objects: {
        ticket: [
            {
                to: 'Ticket',
                identity: ['remote_id'],
                fields: {
                    id: 'remote_id',
                    // Default title attribute key used by Intercom ticket types.
                    'ticket_attributes._default_title_': 'name',
                    'ticket_attributes._default_description_': 'description',
                    ticket_state: {
                        to: 'status',
                        transform: 'intercomTicketStateToMerge',
                    },
                    category: 'ticket_type',
                    admin_assignee_id: {
                        to: 'assignees',
                        transform: 'intercomIdToSingletonArray',
                    },
                    team_assignee_id: {
                        to: 'assigned_teams',
                        transform: 'intercomIdToSingletonArray',
                    },
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
                ops: ['read', 'create', 'update', 'subscribe'],
            },
        ],
    },
};

module.exports = { ticketMapping };
