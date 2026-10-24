/**
 * ServiceNow Incident / CSM Case → canonical Ticket mapping (ADR-057).
 *
 * Status: UNVALIDATED — the Frigg canonical registry / `support@1` schema
 * package does not exist yet. Field names follow the Merge Ticketing `Ticket`
 * common model so a future registry can adopt this mapping near 1:1.
 *
 * Sources:
 * - ADR-057: frigg docs/architecture-decisions/057-canonical-schema.md
 * - Merge Ticketing Ticket: https://docs.merge.dev/ticketing/tickets/
 * - Table API (incident samples): https://developer.servicenow.com/print_page.do?category=null&identifier=c_TableAPI&module=api&release=yokohama
 * - CSM case table: sn_customerservice_case (not csm_case)
 *
 * Exposed via `extensions.mapping` from index.js (`schemas.support`).
 */

const incidentTicketMapping = {
    to: 'Ticket',
    identity: ['remote_id'],
    fields: {
        // ServiceNow field → Merge Ticketing Ticket field
        sys_id: 'remote_id',
        number: 'remote_display_id',
        short_description: 'name',
        description: 'description',
        state: {
            to: 'status',
            transform: 'servicenowIncidentStateToMerge',
        },
        priority: {
            to: 'priority',
            transform: 'servicenowPriorityToMerge',
        },
        assigned_to: {
            to: 'assignees',
            transform: 'servicenowRefToSingletonArray',
        },
        assignment_group: {
            to: 'assigned_teams',
            transform: 'servicenowRefToSingletonArray',
        },
        caller_id: 'contact',
        company: 'account',
        sys_created_by: 'creator',
        sys_created_on: 'remote_created_at',
        sys_updated_on: 'remote_updated_at',
    },
    // Informational only; ADR-045 traits are authoritative when present.
    ops: ['read', 'create', 'update'],
};

const caseTicketMapping = {
    to: 'Ticket',
    identity: ['remote_id'],
    fields: {
        sys_id: 'remote_id',
        number: 'remote_display_id',
        short_description: 'name',
        description: 'description',
        state: {
            to: 'status',
            transform: 'servicenowIncidentStateToMerge',
        },
        priority: {
            to: 'priority',
            transform: 'servicenowPriorityToMerge',
        },
        assigned_to: {
            to: 'assignees',
            transform: 'servicenowRefToSingletonArray',
        },
        account: 'account',
        contact: 'contact',
        sys_created_on: 'remote_created_at',
        sys_updated_on: 'remote_updated_at',
    },
    ops: ['read', 'create', 'update'],
};

const ticketMapping = {
    schema: 'support@1',
    // Explicit until `@friggframework/canonical-schema-support` (or equivalent)
    // ships and `validateCanonicalMapping()` can run against a real registry.
    validation: 'UNVALIDATED',
    objects: {
        // Table API object keys used by this module's capabilities.
        incident: [incidentTicketMapping],
        case: [caseTicketMapping],
    },
};

module.exports = { ticketMapping };
