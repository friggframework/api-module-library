const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * ServiceNow Table API + Attachment API client.
 *
 * Auth (official):
 * - OAuth 2.0 authorization-code per instance
 *   https://{instance}.service-now.com/oauth_auth.do
 *   https://{instance}.service-now.com/oauth_token.do
 *   (application/x-www-form-urlencoded)
 * - Basic Authentication as an alternate for REST calls
 *
 * Base host: https://{instance}.service-now.com
 * Table API: /api/now/table/{tableName}
 * Attachment API: /api/now/attachment
 *
 * Docs:
 * - Table API: https://developer.servicenow.com/print_page.do?category=null&identifier=c_TableAPI&module=api&release=yokohama
 * - Attachment API: https://developer.servicenow.com/print_page.do?category=null&identifier=c_AttachmentAPI&module=api&release=yokohama
 * - OAuth auth-code: https://www.servicenow.com/docs/r/yokohama/platform-security/authentication/c_OAuthAuthorizationCodeFlow.html
 * - OAuth token params: https://www.servicenow.com/docs/r/yokohama/platform-security/authentication/r_OAuthAPIRequestParameters.html
 *
 * Webhooks: ServiceNow does NOT expose a Table/ITSM "subscribe webhook" REST API.
 * Outbound notifications are configured in-instance via Outbound REST Messages,
 * Business Rules, or Flow Designer / Workflow Studio REST steps. See README.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.instance = get(params, 'instance', null) || null;
        // username/password support basic-auth alternate (also used by password grant docs).
        this.username = get(params, 'username', this.username);
        this.password = get(params, 'password', this.password);

        this.URLs = {
            table: (tableName) => `/api/now/table/${tableName}`,
            tableRecord: (tableName, sysId) =>
                `/api/now/table/${tableName}/${sysId}`,
            attachments: '/api/now/attachment',
            attachmentById: (sysId) => `/api/now/attachment/${sysId}`,
        };

        this._applyInstance();
    }

    _applyInstance() {
        // Match OpenAPI servers[0].url when unset so spec-sync can assert equality.
        if (!this.instance || this.instance === '{instance}') {
            this.baseUrl = 'https://{instance}.service-now.com';
            this.tokenUri = 'https://{instance}.service-now.com/oauth_token.do';
        } else {
            this.baseUrl = `https://${this.instance}.service-now.com`;
            this.tokenUri = `https://${this.instance}.service-now.com/oauth_token.do`;
        }
        this.authorizationUri = this._buildAuthorizationUri();
        // Basic-auth connections are not refreshable.
        this.isRefreshable = !!this.access_token || !!this.refresh_token;
    }

    _buildAuthorizationUri() {
        const host =
            !this.instance || this.instance === '{instance}'
                ? 'https://{instance}.service-now.com'
                : `https://${this.instance}.service-now.com`;
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirect_uri || '',
            client_id: this.client_id || '',
            state: this.state || crypto.randomBytes(16).toString('hex'),
        });
        // Core Yokohama auth-code examples omit scope. Only append when configured.
        if (this.scope) {
            params.set('scope', this.scope);
        }
        return `${host}/oauth_auth.do?${params.toString()}`;
    }

    /**
     * Set the ServiceNow instance subdomain (e.g. `dev12345` for
     * `https://dev12345.service-now.com`) and rebuild base/token/authorize URLs.
     */
    setInstance(instance) {
        this.instance = instance;
        this._applyInstance();
        return this;
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    /**
     * Authorization requirements for the Frigg auth UI / `frigg auth` CLI.
     * OAuth is per-instance, so the form collects the instance subdomain.
     * Basic auth is an alternate: provide username + password via setAuthParams
     * instead of completing the OAuth redirect.
     */
    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'ServiceNow Authentication',
                    type: 'object',
                    required: ['instance'],
                    properties: {
                        instance: {
                            type: 'string',
                            title: 'Instance',
                        },
                        username: {
                            type: 'string',
                            title: 'Username (basic auth alternate)',
                        },
                        password: {
                            type: 'string',
                            title: 'Password (basic auth alternate)',
                        },
                    },
                },
                uiSchema: {
                    instance: {
                        'ui:help':
                            'Instance subdomain only (dev12345 from https://dev12345.service-now.com).',
                        'ui:placeholder': 'dev12345',
                    },
                    username: {
                        'ui:help':
                            'Optional. When set with password, uses HTTP Basic instead of OAuth.',
                    },
                    password: {
                        'ui:widget': 'password',
                    },
                },
            },
        };
    }

    /**
     * Exchange authorization code for tokens.
     * ServiceNow expects application/x-www-form-urlencoded (OAuth2Requester default).
     * Scope is omitted unless configured — core auth-code docs do not require it.
     * @see https://www.servicenow.com/docs/r/yokohama/platform-security/authentication/r_OAuthAPIRequestParameters.html
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', this.redirect_uri);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        if (this.scope) {
            params.append('scope', this.scope);
        }
        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        this.isRefreshable = true;
        return response;
    }

    /**
     * Refresh access token.
     * Official params: grant_type, client_id, client_secret, refresh_token.
     * @see https://www.servicenow.com/docs/r/yokohama/platform-security/authentication/r_OAuthAPIRequestParameters.html
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append(
            'refresh_token',
            get(refreshTokenObject, 'refresh_token', this.refresh_token)
        );
        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Bearer when OAuth token present; otherwise HTTP Basic when username/password set.
     */
    async addAuthHeaders(headers = {}) {
        delete headers.Authorization;
        if (this.access_token) {
            headers.Authorization = `Bearer ${this.access_token}`;
        } else if (this.username && this.password) {
            headers.Authorization =
                'Basic ' +
                Buffer.from(`${this.username}:${this.password}`).toString(
                    'base64'
                );
        }
        return headers;
    }

    isAuthenticated() {
        if (this.access_token) return true;
        return !!(
            this.username &&
            this.password &&
            String(this.username).trim().length > 0
        );
    }

    // ---- Query / table helpers ---------------------------------------------

    /**
     * Drop null/undefined query values. Official list GET params include
     * sysparm_query, sysparm_limit, sysparm_offset, sysparm_fields,
     * sysparm_display_value.
     */
    _normalizeQuery(query = {}) {
        const q = { ...(query || {}) };
        for (const key of Object.keys(q)) {
            if (q[key] === undefined || q[key] === null) delete q[key];
        }
        return q;
    }

    async _listTable(tableName, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.table(tableName),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            query: this._normalizeQuery(query),
        });
    }

    async _getTableRecord(tableName, sysId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tableRecord(tableName, sysId),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            query: this._normalizeQuery(query),
        });
    }

    async _createTableRecord(tableName, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.table(tableName),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body,
        });
    }

    async _updateTableRecord(tableName, sysId, body = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.tableRecord(tableName, sysId),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body,
        });
    }

    // ---- Incident ----------------------------------------------------------

    /** GET /api/now/table/incident */
    async listIncidents(query = {}) {
        return this._listTable('incident', query);
    }

    /** GET /api/now/table/incident/{sys_id} */
    async getIncident(sysId, query = {}) {
        return this._getTableRecord('incident', sysId, query);
    }

    /** POST /api/now/table/incident */
    async createIncident(body) {
        return this._createTableRecord('incident', body);
    }

    /** PATCH /api/now/table/incident/{sys_id} */
    async updateIncident(sysId, body) {
        return this._updateTableRecord('incident', sysId, body);
    }

    // ---- Service Catalog Request (sc_request) ------------------------------

    /** GET /api/now/table/sc_request */
    async listScRequests(query = {}) {
        return this._listTable('sc_request', query);
    }

    /** GET /api/now/table/sc_request/{sys_id} */
    async getScRequest(sysId, query = {}) {
        return this._getTableRecord('sc_request', sysId, query);
    }

    // ---- Requested Item (sc_req_item) --------------------------------------

    /** GET /api/now/table/sc_req_item */
    async listScReqItems(query = {}) {
        return this._listTable('sc_req_item', query);
    }

    /** GET /api/now/table/sc_req_item/{sys_id} */
    async getScReqItem(sysId, query = {}) {
        return this._getTableRecord('sc_req_item', sysId, query);
    }

    // ---- Problem -----------------------------------------------------------

    /** GET /api/now/table/problem */
    async listProblems(query = {}) {
        return this._listTable('problem', query);
    }

    /** GET /api/now/table/problem/{sys_id} */
    async getProblem(sysId, query = {}) {
        return this._getTableRecord('problem', sysId, query);
    }

    // ---- Change Request ----------------------------------------------------

    /** GET /api/now/table/change_request */
    async listChangeRequests(query = {}) {
        return this._listTable('change_request', query);
    }

    /** GET /api/now/table/change_request/{sys_id} */
    async getChangeRequest(sysId, query = {}) {
        return this._getTableRecord('change_request', sysId, query);
    }

    // ---- User (sys_user) ---------------------------------------------------

    /** GET /api/now/table/sys_user */
    async listSysUsers(query = {}) {
        return this._listTable('sys_user', query);
    }

    /** GET /api/now/table/sys_user/{sys_id} */
    async getSysUser(sysId, query = {}) {
        return this._getTableRecord('sys_user', sysId, query);
    }

    // ---- Company (core_company) --------------------------------------------

    /** GET /api/now/table/core_company */
    async listCompanies(query = {}) {
        return this._listTable('core_company', query);
    }

    /** GET /api/now/table/core_company/{sys_id} */
    async getCompany(sysId, query = {}) {
        return this._getTableRecord('core_company', sysId, query);
    }

    // ---- CSM Account (customer_account) ------------------------------------

    /**
     * GET /api/now/table/customer_account
     * Official CSM B2B account table (extends core_company).
     * Requires Customer Service plugin / appropriate roles on the instance.
     */
    async listCustomerAccounts(query = {}) {
        return this._listTable('customer_account', query);
    }

    /** GET /api/now/table/customer_account/{sys_id} */
    async getCustomerAccount(sysId, query = {}) {
        return this._getTableRecord('customer_account', sysId, query);
    }

    // ---- CSM Case (sn_customerservice_case) --------------------------------

    /**
     * GET /api/now/table/sn_customerservice_case
     * Official CSM case table name is `sn_customerservice_case` (not `csm_case`).
     * Dedicated Case API (`/api/sn_customerservice/case`) also exists; this module
     * uses the Table API path for parity with other ITSM objects.
     */
    async listCases(query = {}) {
        return this._listTable('sn_customerservice_case', query);
    }

    /** GET /api/now/table/sn_customerservice_case/{sys_id} */
    async getCase(sysId, query = {}) {
        return this._getTableRecord('sn_customerservice_case', sysId, query);
    }

    /** POST /api/now/table/sn_customerservice_case */
    async createCase(body) {
        return this._createTableRecord('sn_customerservice_case', body);
    }

    /** PATCH /api/now/table/sn_customerservice_case/{sys_id} */
    async updateCase(sysId, body) {
        return this._updateTableRecord('sn_customerservice_case', sysId, body);
    }

    // ---- Attachments (metadata) --------------------------------------------

    /**
     * List attachment metadata.
     * GET /api/now/attachment
     * Filter with sysparm_query on sys_attachment (e.g. table_name / table_sys_id).
     */
    async listAttachments(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.attachments,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            query: this._normalizeQuery(query),
        });
    }

    /**
     * Get attachment metadata by sys_id.
     * GET /api/now/attachment/{sys_id}
     * (File bytes are at /api/now/attachment/{sys_id}/file — not wrapped here.)
     */
    async getAttachment(sysId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.attachmentById(sysId),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            query: this._normalizeQuery(query),
        });
    }
}

module.exports = { Api };
