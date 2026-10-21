const { Api } = require('./api');
const { Definition } = require('./definition');
const { ticketMapping } = require('./mappings/ticket');
const { companyMapping } = require('./mappings/company');

/**
 * Named transforms referenced by mappings/*.js (ADR-057).
 *
 * Merge Ticketing enums: status OPEN|CLOSED|IN_PROGRESS|ON_HOLD;
 * priority URGENT|HIGH|NORMAL|LOW.
 *
 * ServiceNow incident `state` and `priority` are numeric choice values in the
 * platform (commonly 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed for
 * state; 1–5 for priority). Exact labels can be customized per instance — these
 * transforms cover the out-of-box numeric codes documented in Table API samples
 * and common ITSM defaults. UNVALIDATED until a canonical registry exists.
 */
const mappingTransforms = {
    servicenowIncidentStateToMerge: (value) => {
        if (value == null || value === '') return value;
        // Display-value strings from sysparm_display_value=true
        const asString = String(value).toLowerCase().trim();
        const stringMap = {
            new: 'OPEN',
            open: 'OPEN',
            'in progress': 'IN_PROGRESS',
            'on hold': 'ON_HOLD',
            hold: 'ON_HOLD',
            resolved: 'CLOSED',
            closed: 'CLOSED',
            canceled: 'CLOSED',
            cancelled: 'CLOSED',
        };
        if (stringMap[asString] != null) return stringMap[asString];

        const n = Number(value);
        const numericMap = {
            1: 'OPEN', // New
            2: 'IN_PROGRESS',
            3: 'ON_HOLD',
            6: 'CLOSED', // Resolved
            7: 'CLOSED',
            8: 'CLOSED', // Canceled
        };
        if (!Number.isNaN(n) && numericMap[n] != null) return numericMap[n];
        return String(value).toUpperCase();
    },
    servicenowPriorityToMerge: (value) => {
        if (value == null || value === '') return value;
        const asString = String(value).toLowerCase().trim();
        const stringMap = {
            critical: 'URGENT',
            urgent: 'URGENT',
            high: 'HIGH',
            moderate: 'NORMAL',
            medium: 'NORMAL',
            normal: 'NORMAL',
            low: 'LOW',
            planning: 'LOW',
        };
        if (stringMap[asString] != null) return stringMap[asString];

        const n = Number(value);
        // OOB incident priority: 1 Critical, 2 High, 3 Moderate, 4 Low, 5 Planning
        const numericMap = {
            1: 'URGENT',
            2: 'HIGH',
            3: 'NORMAL',
            4: 'LOW',
            5: 'LOW',
        };
        if (!Number.isNaN(n) && numericMap[n] != null) return numericMap[n];
        return String(value).toUpperCase();
    },
    /**
     * Reference fields may be a sys_id string or `{ value, display_value }` when
     * sysparm_display_value=all.
     */
    servicenowRefToSingletonArray: (value) => {
        if (value == null || value === '') return [];
        if (typeof value === 'object') {
            const id = value.value || value.sys_id || value.link;
            return id ? [String(id)] : [];
        }
        return [String(value)];
    },
};

module.exports = {
    Api,
    Definition,
    extensions: {
        // No extensions/webhooks: ServiceNow has no subscribe-webhook REST API.
        // Outbound REST Messages / Business Rules / Flow Designer are documented
        // in README.md.
        mapping: {
            schemas: {
                support: ticketMapping,
                business: companyMapping,
            },
            transforms: mappingTransforms,
        },
    },
};
