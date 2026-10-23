const { Api } = require('./api');
const { Definition } = require('./definition');
const webhooks = require('./extensions/webhooks');
const { ticketMapping } = require('./mappings/ticket');
const { companyMapping } = require('./mappings/company');

/**
 * Named transforms referenced by mappings/*.js (ADR-057).
 * Merge Ticketing enums: status OPEN|CLOSED|IN_PROGRESS|ON_HOLD;
 * priority URGENT|HIGH|NORMAL|LOW.
 *
 * Freshdesk ticket status (docs): 2 Open, 3 Pending, 4 Resolved, 5 Closed.
 * Freshdesk priority (docs): 1 Low, 2 Medium, 3 High, 4 Urgent.
 */
const mappingTransforms = {
    freshdeskStatusToMerge: (value) => {
        if (value == null) return value;
        const map = {
            2: 'OPEN',
            3: 'IN_PROGRESS',
            4: 'CLOSED',
            5: 'CLOSED',
            open: 'OPEN',
            pending: 'IN_PROGRESS',
            resolved: 'CLOSED',
            closed: 'CLOSED',
        };
        const key =
            typeof value === 'number' ? value : String(value).toLowerCase();
        return map[key] != null ? map[key] : String(value).toUpperCase();
    },
    freshdeskPriorityToMerge: (value) => {
        if (value == null) return value;
        const map = {
            1: 'LOW',
            2: 'NORMAL',
            3: 'HIGH',
            4: 'URGENT',
            low: 'LOW',
            medium: 'NORMAL',
            high: 'HIGH',
            urgent: 'URGENT',
        };
        const key =
            typeof value === 'number' ? value : String(value).toLowerCase();
        return map[key] != null ? map[key] : String(value).toUpperCase();
    },
    freshdeskIdToSingletonArray: (value) => {
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
                business: companyMapping,
            },
            transforms: mappingTransforms,
        },
    },
};
