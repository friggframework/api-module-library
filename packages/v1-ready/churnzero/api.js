const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Default base URL from ChurnZero's published OpenAPI sample server
 * (MarketingPony demo tenant). Real tenants override via `base_url`:
 *   https://{tenant}.{region}app.churnzero.net/public/v1
 * Official OAS: https://app.churnzero.net/developers/churnzero_oas.json
 */
const DEFAULT_BASE_URL =
    'https://marketingpony.us1app.churnzero.net/public/v1';

/**
 * ChurnZero REST (OData v4) API client.
 *
 * Auth: HTTP Basic — ChurnZero username + user API Key (API Key as password).
 *   Authorization: Basic base64(username:apiKey)
 * Create keys: Admin → API Keys. Requires REST API add-on + Bulk Read perms.
 *
 * Docs: https://app.churnzero.net/developers
 * OpenAPI: https://app.churnzero.net/developers/churnzero_oas.json
 *
 * The curated contract in ./churnzero.openapi.yaml is the source of truth this
 * client mirrors 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        this.username =
            get(params, 'username', null) || get(params, 'user', null);
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'password', null);
        if (this.api_key) this.password = this.api_key;

        const rawBase =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            DEFAULT_BASE_URL;
        // Persistable snake_case alias + requester camelCase must stay aligned.
        this.base_url = String(rawBase).replace(/\/+$/, '');
        this.baseUrl = this.base_url;

        this.URLs = {
            accounts: '/Account',
            accountById: (id) => `/Account(${id})`,
            accountByExternalId: (externalId) =>
                `/Account(AccountExternalId='${this._odataString(externalId)}')`,
            accountPrimaryChurnScore: (id) =>
                `/Account(${id})/PrimaryChurnScore`,
            contacts: '/Contact',
            contactById: (id) => `/Contact(${id})`,
            contactByExternalIds: (accountExternalId, contactExternalId) =>
                `/Contact(AccountExternalId='${this._odataString(
                    accountExternalId
                )}',ContactExternalId='${this._odataString(
                    contactExternalId
                )}')`,
            userAccounts: '/UserAccount',
            userAccountById: (id) => `/UserAccount(${id})`,
            churnScores: '/ChurnScore',
            churnScoreById: (id) => `/ChurnScore(${id})`,
            churnScoreCalculations: '/ChurnScoreCalculation',
            churnScoreCalculationById: (id) =>
                `/ChurnScoreCalculation(${id})`,
            tasks: '/Task',
            taskById: (id) => `/Task(${id})`,
            events: '/Event',
            eventById: (id) => `/Event(${id})`,
            notes: '/Note',
            noteById: (id) => `/Note(${id})`,
            meetings: '/Meeting',
            meetingById: (id) => `/Meeting(${id})`,
            messages: '/Message',
            messageById: (id) => `/Message(${id})`,
        };
    }

    /** Escape a string for use inside an OData single-quoted literal. */
    _odataString(value) {
        return String(value).replace(/'/g, "''");
    }

    /**
     * Build an OData query object from common aliases + passthrough keys.
     * Official query options: $filter $select $top $skip $orderby $expand
     * $count $apply $search (see OpenAPI / REST reference).
     */
    _odataQuery(params = {}) {
        const query = {};
        const map = {
            filter: '$filter',
            select: '$select',
            top: '$top',
            skip: '$skip',
            orderby: '$orderby',
            expand: '$expand',
            count: '$count',
            apply: '$apply',
            search: '$search',
        };
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            const odataKey = map[key] || key;
            query[odataKey] = Array.isArray(value) ? value.join(',') : value;
        }
        return query;
    }

    _getPath(path, params = {}) {
        const query = this._odataQuery(params);
        const options = { url: this.baseUrl + path };
        if (Object.keys(query).length) options.query = query;
        return this._get(options);
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'ChurnZero Authentication',
                    type: 'object',
                    required: ['username', 'api_key', 'base_url'],
                    properties: {
                        username: {
                            type: 'string',
                            title: 'ChurnZero Username',
                        },
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        base_url: {
                            type: 'string',
                            title: 'REST API Base URL',
                            default: DEFAULT_BASE_URL,
                        },
                    },
                },
                uiSchema: {
                    username: {
                        'ui:help':
                            'Your ChurnZero login username. Used as the Basic-auth username.',
                    },
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'User API Key from Admin → API Keys. Used as the Basic-auth password.',
                    },
                    base_url: {
                        'ui:help':
                            'Tenant REST base, e.g. https://{tenant}.us1app.churnzero.net/public/v1 (no trailing slash). Shown in personalized docs at app.churnzero.net/developers.',
                        'ui:placeholder': DEFAULT_BASE_URL,
                    },
                },
            },
        };
    }

    // ---- Accounts ----------------------------------------------------------

    /** GET /Account — list accounts (OData). */
    async listAccounts(params = {}) {
        return this._getPath(this.URLs.accounts, params);
    }

    /** GET /Account({Id}) */
    async getAccount(id, params = {}) {
        return this._getPath(this.URLs.accountById(id), params);
    }

    /** GET /Account(AccountExternalId='{AccountExternalId}') */
    async getAccountByExternalId(accountExternalId, params = {}) {
        return this._getPath(
            this.URLs.accountByExternalId(accountExternalId),
            params
        );
    }

    /** GET /Account({Id})/PrimaryChurnScore */
    async getAccountPrimaryChurnScore(id, params = {}) {
        return this._getPath(this.URLs.accountPrimaryChurnScore(id), params);
    }

    // ---- Contacts ----------------------------------------------------------

    /** GET /Contact */
    async listContacts(params = {}) {
        return this._getPath(this.URLs.contacts, params);
    }

    /** GET /Contact({Id}) */
    async getContact(id, params = {}) {
        return this._getPath(this.URLs.contactById(id), params);
    }

    /**
     * GET /Contact(AccountExternalId='…',ContactExternalId='…')
     */
    async getContactByExternalId(
        accountExternalId,
        contactExternalId,
        params = {}
    ) {
        return this._getPath(
            this.URLs.contactByExternalIds(
                accountExternalId,
                contactExternalId
            ),
            params
        );
    }

    // ---- Internal users (CSMs) ---------------------------------------------

    /** GET /UserAccount — internal ChurnZero users (not customer contacts). */
    async listUserAccounts(params = {}) {
        return this._getPath(this.URLs.userAccounts, params);
    }

    /** GET /UserAccount({Id}) */
    async getUserAccount(id, params = {}) {
        return this._getPath(this.URLs.userAccountById(id), params);
    }

    // ---- Health / churn scores ---------------------------------------------

    /** GET /ChurnScore — score definitions. */
    async listChurnScores(params = {}) {
        return this._getPath(this.URLs.churnScores, params);
    }

    /** GET /ChurnScore({Id}) */
    async getChurnScore(id, params = {}) {
        return this._getPath(this.URLs.churnScoreById(id), params);
    }

    /** GET /ChurnScoreCalculation — per-account calculated scores. */
    async listChurnScoreCalculations(params = {}) {
        return this._getPath(this.URLs.churnScoreCalculations, params);
    }

    /** GET /ChurnScoreCalculation({Id}) */
    async getChurnScoreCalculation(id, params = {}) {
        return this._getPath(this.URLs.churnScoreCalculationById(id), params);
    }

    // ---- Tasks (CTA-adjacent; no CTA entity in OpenAPI) --------------------

    /** GET /Task */
    async listTasks(params = {}) {
        return this._getPath(this.URLs.tasks, params);
    }

    /** GET /Task({Id}) */
    async getTask(id, params = {}) {
        return this._getPath(this.URLs.taskById(id), params);
    }

    // ---- Timeline-adjacent activity ----------------------------------------

    /** GET /Event — product-usage events. */
    async listEvents(params = {}) {
        return this._getPath(this.URLs.events, params);
    }

    /** GET /Event({Id}) */
    async getEvent(id, params = {}) {
        return this._getPath(this.URLs.eventById(id), params);
    }

    /** GET /Note */
    async listNotes(params = {}) {
        return this._getPath(this.URLs.notes, params);
    }

    /** GET /Note({Id}) */
    async getNote(id, params = {}) {
        return this._getPath(this.URLs.noteById(id), params);
    }

    /** GET /Meeting */
    async listMeetings(params = {}) {
        return this._getPath(this.URLs.meetings, params);
    }

    /** GET /Meeting({Id}) */
    async getMeeting(id, params = {}) {
        return this._getPath(this.URLs.meetingById(id), params);
    }

    /** GET /Message */
    async listMessages(params = {}) {
        return this._getPath(this.URLs.messages, params);
    }

    /** GET /Message({Id}) */
    async getMessage(id, params = {}) {
        return this._getPath(this.URLs.messageById(id), params);
    }

    /**
     * Lightweight authenticated request used to validate credentials.
     * Listing a single UserAccount page returns 200 for valid Basic auth.
     */
    async testAuth() {
        return this.listUserAccounts({ top: 1 });
    }
}

module.exports = { Api, DEFAULT_BASE_URL };
