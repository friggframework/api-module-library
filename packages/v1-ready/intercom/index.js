const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { conversationMapping } = require('./mappings/conversation');
const { ticketMapping } = require('./mappings/ticket');
const { contactMapping } = require('./mappings/contact');
const { companyMapping } = require('./mappings/company');

/**
 * Named transforms referenced by mappings/* (ADR-057).
 * Merge Ticketing enums: status OPEN|CLOSED|IN_PROGRESS|ON_HOLD;
 * priority URGENT|HIGH|NORMAL|LOW.
 */
const mappingTransforms = {
    intercomConversationStateToMerge: (value) => {
        if (value == null) return value;
        const map = {
            open: 'OPEN',
            closed: 'CLOSED',
            snoozed: 'ON_HOLD',
        };
        const key = String(value).toLowerCase();
        return map[key] != null ? map[key] : String(value).toUpperCase();
    },
    intercomTicketStateToMerge: (value) => {
        if (value == null) return value;
        // ticket_state may be an object { category, … } or a string category.
        const category =
            typeof value === 'object' && value !== null
                ? value.category || value.internal_label || value.id
                : value;
        const map = {
            submitted: 'OPEN',
            in_progress: 'IN_PROGRESS',
            waiting_on_customer: 'ON_HOLD',
            resolved: 'CLOSED',
        };
        const key = String(category).toLowerCase();
        return map[key] != null ? map[key] : String(category).toUpperCase();
    },
    intercomPriorityToMerge: (value) => {
        if (value == null) return value;
        const key = String(value).toLowerCase();
        if (key === 'priority' || key === 'high') return 'HIGH';
        if (key === 'not_priority' || key === 'normal') return 'NORMAL';
        if (key === 'urgent') return 'URGENT';
        if (key === 'low') return 'LOW';
        return String(value).toUpperCase();
    },
    intercomIdToSingletonArray: (value) => {
        if (value == null || value === '') return [];
        return [String(value)];
    },
    intercomContactsToPrimaryId: (value) => {
        if (value == null) return null;
        if (typeof value === 'string' || typeof value === 'number') {
            return String(value);
        }
        const list = Array.isArray(value)
            ? value
            : Array.isArray(value.contacts)
              ? value.contacts
              : [];
        const first = list[0];
        if (!first) return null;
        return first.id != null ? String(first.id) : null;
    },
    intercomUnixToIso: (value) => {
        if (value == null || value === '') return value;
        const n = Number(value);
        if (!Number.isFinite(n)) return value;
        // Intercom timestamps are unix seconds.
        return new Date(n * 1000).toISOString();
    },
};

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                // support@1 — conversation + ticket both map to Merge Ticket
                support: {
                    schema: 'support@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...conversationMapping.objects,
                        ...ticketMapping.objects,
                    },
                },
                // business@1 — contact + company
                business: {
                    schema: 'business@1',
                    validation: 'UNVALIDATED',
                    objects: {
                        ...contactMapping.objects,
                        ...companyMapping.objects,
                    },
                },
            },
            transforms: mappingTransforms,
        },
    },
};
