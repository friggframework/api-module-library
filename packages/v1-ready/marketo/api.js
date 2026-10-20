const { OAuth2Requester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Adobe Marketo Engage REST API client.
 *
 * Auth: OAuth 2.0 two-legged client credentials.
 *   GET https://{munchkinId}.mktorest.com/identity/oauth/token
 *     ?grant_type=client_credentials&client_id=...&client_secret=...
 *   Then: Authorization: Bearer <access_token>
 *
 * Base URL (REST): https://{munchkinId}.mktorest.com/rest
 * Identity URL:    https://{munchkinId}.mktorest.com/identity
 *
 * Tokens last ~3600 seconds. There is no refresh_token; re-request with
 * client credentials when expired (codes 601/602).
 *
 * Docs:
 *   https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/authentication
 *   https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/rest-api
 *   https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/endpoint-reference
 *
 * The canonical machine-readable contract lives in ./marketo.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Default munchkinId `000-AAA-000` is a placeholder so the OpenAPI server URL
 * matches `baseUrl` when no real instance is configured. Pass `munchkin_id`
 * (or a full `base_url`) for a real Marketo instance.
 */
const DEFAULT_MUNCHKIN_ID = '000-AAA-000';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        // Marketo has no authorization_code / refresh_token flow.
        const withGrant = {
            ...params,
            grant_type: get(params, 'grant_type', 'client_credentials'),
        };
        super(withGrant);

        this.munchkin_id =
            get(params, 'munchkin_id', null) || DEFAULT_MUNCHKIN_ID;

        const overrideBase = get(params, 'base_url', null) || get(params, 'baseUrl', null);
        this.baseUrl =
            overrideBase || `https://${this.munchkin_id}.mktorest.com/rest`;
        this.identityUrl = `https://${this.munchkin_id}.mktorest.com/identity`;
        this.tokenUri = `${this.identityUrl}/oauth/token`;

        this.access_token = get(params, 'access_token', null);
        this.client_id = get(params, 'client_id', null) || this.client_id;
        this.client_secret =
            get(params, 'client_secret', null) || this.client_secret;

        // Client-credentials tokens are re-minted, not refreshed.
        this.isRefreshable = true;

        this.URLs = {
            leadById: (id) => `/v1/lead/${id}.json`,
            leads: '/v1/leads.json',
            leadsDelete: '/v1/leads/delete.json',
            leadsDescribe2: '/v1/leads/describe2.json',
            lists: '/v1/lists.json',
            listById: (id) => `/v1/lists/${id}.json`,
            listLeads: (listId) => `/v1/lists/${listId}/leads.json`,
            listIsMember: (listId) =>
                `/v1/lists/${listId}/leads/ismember.json`,
        };
    }

    /**
     * JSON-Schema form for collecting Marketo Custom Service credentials.
     * Client ID / Secret come from Admin → Integration → LaunchPoint.
     * Munchkin ID / REST endpoint come from Admin → Integration → Web Services.
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: {
                    title: 'Marketo Authentication',
                    type: 'object',
                    required: ['munchkin_id', 'client_id', 'client_secret'],
                    properties: {
                        munchkin_id: {
                            type: 'string',
                            title: 'Munchkin ID',
                        },
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                    },
                },
                uiSchema: {
                    munchkin_id: {
                        'ui:help':
                            'From Admin → Integration → Web Services (REST API section). Used to build https://{munchkinId}.mktorest.com.',
                        'ui:placeholder': '123-ABC-456',
                    },
                    client_id: {
                        'ui:help':
                            'From Admin → Integration → LaunchPoint → View Details on your Custom service.',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Paired with Client ID for the OAuth client_credentials grant.',
                    },
                },
            },
        };
    }

    /**
     * Apply a new munchkin id (rebuilds REST + identity base URLs).
     */
    setMunchkinId(munchkinId) {
        if (!munchkinId) return;
        this.munchkin_id = munchkinId;
        this.baseUrl = `https://${this.munchkin_id}.mktorest.com/rest`;
        this.identityUrl = `https://${this.munchkin_id}.mktorest.com/identity`;
        this.tokenUri = `${this.identityUrl}/oauth/token`;
    }

    /**
     * Marketo's token endpoint expects grant_type/client_id/client_secret as
     * query parameters (GET or POST). The base OAuth2Requester posts a JSON
     * body, which Marketo does not accept — override to match the official
     * Authentication docs.
     *
     * @see https://experienceleague.adobe.com/en/docs/marketo-developer/marketo/rest/authentication
     */
    async getTokenFromClientCredentials() {
        try {
            const tokenRes = await this._get({
                url: this.tokenUri,
                headers: {
                    Accept: 'application/json',
                },
                query: {
                    grant_type: 'client_credentials',
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                },
            });
            await this.setTokens(tokenRes);
            // Marketo returns `scope` = the API-Only user email that owns the
            // custom service — useful as a stable identity hint.
            this.token_scope = tokenRes?.scope || null;
            return tokenRes;
        } catch (error) {
            await this.notify(this.DLGT_INVALID_AUTH, {
                statusCode: error?.statusCode,
            });
        }
    }

    /**
     * Detect Marketo auth expiry / access-denied in a successful HTTP body.
     * Codes 601 (Access token invalid), 602 (expired), 603 (access denied).
     */
    checkExpired(body) {
        const { errors = [], success } = body || {};
        if (success !== false) return false;
        return errors.some(
            (e) => e.code === '601' || e.code === '602' || e.code === '603'
        );
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    // ---- Leads -------------------------------------------------------------

    /**
     * Get Lead by Id.
     * GET /rest/v1/lead/{id}.json
     * Optional query: fields (comma-separated API field names).
     */
    async getLeadById(id, params = {}) {
        const query = {};
        if (params.fields) query.fields = params.fields;
        return this._get({
            url: this.baseUrl + this.URLs.leadById(id),
            query,
        });
    }

    /**
     * Get Leads by Filter Type.
     * GET /rest/v1/leads.json
     * Required: filterType, filterValues (comma-separated, up to 300).
     * Optional: fields, batchSize, nextPageToken.
     */
    async getLeadsByFilterType(params = {}) {
        const query = {
            filterType: params.filterType,
            filterValues: Array.isArray(params.filterValues)
                ? params.filterValues.join(',')
                : params.filterValues,
        };
        if (params.fields) {
            query.fields = Array.isArray(params.fields)
                ? params.fields.join(',')
                : params.fields;
        }
        if (params.batchSize != null) query.batchSize = params.batchSize;
        if (params.nextPageToken) query.nextPageToken = params.nextPageToken;
        return this._get({
            url: this.baseUrl + this.URLs.leads,
            query,
        });
    }

    /**
     * Sync Leads (create / update).
     * POST /rest/v1/leads.json
     *
     * body: {
     *   action?: 'createOrUpdate' | 'createOnly' | 'updateOnly' | 'createDuplicate',
     *   lookupField?: string,   // default email
     *   partitionName?: string,
     *   input: [ { email, firstName, ... } ]  // up to 300
     * }
     */
    async syncLeads(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            body,
        });
    }

    /**
     * Delete Leads.
     * POST /rest/v1/leads/delete.json
     * body: { input: [ { id } ] } — up to 300 ids.
     */
    async deleteLeads(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leadsDelete,
            body,
        });
    }

    /**
     * Describe Lead (v2).
     * GET /rest/v1/leads/describe2.json
     * Returns searchable fields allowed for filterType and field metadata.
     */
    async describeLeads() {
        return this._get({
            url: this.baseUrl + this.URLs.leadsDescribe2,
        });
    }

    // ---- Static lists (Lead Database) --------------------------------------

    /**
     * Get Lists.
     * GET /rest/v1/lists.json
     * Optional query: id, name, programName, workspaceName, batchSize, nextPageToken.
     */
    async getLists(params = {}) {
        const query = {};
        for (const key of [
            'id',
            'name',
            'programName',
            'workspaceName',
            'batchSize',
            'nextPageToken',
        ]) {
            if (params[key] != null) query[key] = params[key];
        }
        return this._get({
            url: this.baseUrl + this.URLs.lists,
            query,
        });
    }

    /**
     * Get List by Id.
     * GET /rest/v1/lists/{id}.json
     */
    async getListById(id) {
        return this._get({
            url: this.baseUrl + this.URLs.listById(id),
        });
    }

    /**
     * Get Leads by List Id.
     * GET /rest/v1/lists/{listId}/leads.json
     * Optional: batchSize (default/max 300), nextPageToken, fields.
     */
    async getLeadsByListId(listId, params = {}) {
        const query = {};
        if (params.batchSize != null) query.batchSize = params.batchSize;
        if (params.nextPageToken) query.nextPageToken = params.nextPageToken;
        if (params.fields) {
            query.fields = Array.isArray(params.fields)
                ? params.fields.join(',')
                : params.fields;
        }
        return this._get({
            url: this.baseUrl + this.URLs.listLeads(listId),
            query,
        });
    }

    /**
     * Marketo list-membership endpoints take repeated `id` query params
     * (`?id=1&id=2`). The core Requester query builder stringifies arrays, so
     * we append the repeated keys ourselves.
     */
    _repeatedIdQuery(leadIds = []) {
        const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
        const usp = new URLSearchParams();
        for (const id of ids) {
            if (id === undefined || id === null) continue;
            usp.append('id', String(id));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    /**
     * Add to List.
     * POST /rest/v1/lists/{listId}/leads.json?id=...&id=...
     * Up to 300 lead ids.
     */
    async addToList(listId, leadIds = []) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.listLeads(listId) +
                this._repeatedIdQuery(leadIds),
            body: {},
        });
    }

    /**
     * Remove from List.
     * DELETE /rest/v1/lists/{listId}/leads.json?id=...&id=...
     * Up to 300 lead ids.
     */
    async removeFromList(listId, leadIds = []) {
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.listLeads(listId) +
                this._repeatedIdQuery(leadIds),
        });
    }

    /**
     * Member of List.
     * GET /rest/v1/lists/{listId}/leads/ismember.json?id=...
     * Up to 300 lead ids.
     */
    async isMemberOfList(listId, leadIds = []) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.listIsMember(listId) +
                this._repeatedIdQuery(leadIds),
        });
    }
}

module.exports = { Api, DEFAULT_MUNCHKIN_ID };
