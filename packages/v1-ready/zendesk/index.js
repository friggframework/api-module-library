const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { ticketMapping } = require('./mappings/ticket');

/**
 * Named transforms referenced by mappings/ticket.js (ADR-057).
 * Merge Ticketing enums: status OPEN|CLOSED|IN_PROGRESS|ON_HOLD;
 * priority URGENT|HIGH|NORMAL|LOW.
 */
const mappingTransforms = {
    zendeskStatusToMerge: (value) => {
        if (value == null) return value;
        const map = {
            new: 'OPEN',
            open: 'OPEN',
            pending: 'IN_PROGRESS',
            hold: 'ON_HOLD',
            solved: 'CLOSED',
            closed: 'CLOSED',
        };
        const key = String(value).toLowerCase();
        return map[key] != null ? map[key] : String(value).toUpperCase();
    },
    zendeskPriorityToMerge: (value) => {
        if (value == null) return value;
        return String(value).toUpperCase();
    },
    zendeskIdToSingletonArray: (value) => {
        if (value == null || value === '') return [];
        return [String(value)];
    },
};

module.exports = {
    Api,
    Definition,
    extensions: {
        webhooks,
        mapping: {
            schemas: {
                support: ticketMapping,
            },
            transforms: mappingTransforms,
        },
    },
};
