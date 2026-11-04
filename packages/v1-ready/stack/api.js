const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Stack Global partner integration API client.
 *
 * Stack (https://www.stackglobal.io) is a sales-enablement / sales-cycle
 * platform. Stack does **not** publish a public developer OpenAPI or REST
 * reference. The paths and auth scheme below are ported from Left Hook-owned
 * module code cleared for this library (static Bearer secret + configurable
 * base URL) and must be treated as UNVERIFIED against vendor docs until Stack
 * publishes an official contract.
 *
 * Auth: static secret sent as `Authorization: Bearer <secret>`.
 * Base URL: required tenant/host URL from `STACK_BASE_URL` / auth form
 *   (`base_url`). Default used only for local construction / OpenAPI sync:
 *   `https://api.stackglobal.io` (host responds; path contract unverified).
 *
 * Covered paths (from the ported source only):
 *   POST /integration/authorize
 *   GET  /integration/salesCycle
 *   GET  /integration/company
 *   GET  /integration/company/members
 *
 * The curated contract in ./stack.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://api.stackglobal.io';

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // Persist the bare secret (no "Bearer " prefix). addAuthHeaders() adds
        // the prefix so the credential never stores the scheme twice.
        const raw =
            get(params, 'bearer_token', null) ||
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'secret', null) ||
            process.env.STACK_SECRET ||
            null;
        const token = raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;

        this.bearer_token = token;
        this.api_key_name = 'Authorization';
        this.api_key = token;

        this.baseUrl =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            process.env.STACK_BASE_URL ||
            DEFAULT_BASE_URL;

        this.companyId = get(params, 'companyId', null);
        this.integrationType = get(params, 'integrationType', null);

        this.URLs = {
            authorize: '/integration/authorize',
            salesCycle: '/integration/salesCycle',
            company: '/integration/company',
            companyMembers: '/integration/company/members',
        };
    }

    /**
     * Emit `Authorization: Bearer <secret>`. The stored credential is the bare
     * secret; the "Bearer " prefix is added here so it never lives in the DB.
     */
    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.api_key) {
            h[this.api_key_name] = `Bearer ${this.api_key}`;
        }
        return h;
    }

    setBearerToken(token) {
        const cleaned = token
            ? String(token).replace(/^Bearer\s+/i, '').trim()
            : null;
        this.bearer_token = cleaned;
        this.setApiKey(cleaned);
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _companyQuery(params = {}) {
        return {
            companyId: get(params, 'companyId', this.companyId),
            type: get(params, 'type', this.integrationType),
        };
    }

    // ---- Auth / authorize --------------------------------------------------

    /**
     * Authorize against Stack's partner integration endpoint.
     * POST /integration/authorize
     *
     * Body (from ported source): { companyId, token, type }
     * Response shape is not published by the vendor — treat as opaque.
     */
    async authorize(params = {}) {
        const body = {
            companyId: get(params, 'companyId', this.companyId),
            token: get(params, 'token', this.bearer_token),
            type: get(params, 'type', this.integrationType),
        };
        return this._post({
            url: this.baseUrl + this.URLs.authorize,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Authorize a browser-extension style integration.
     * POST /integration/authorize
     *
     * Body: { type, ...params } where type defaults to this.integrationType
     * (ported source used type `browser_extension` for that flow).
     */
    async browserExtensionAuth(params = {}) {
        const body = {
            type: get(params, 'type', this.integrationType),
            ...params,
        };
        return this._post({
            url: this.baseUrl + this.URLs.authorize,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Sales cycle -------------------------------------------------------

    /**
     * Get the company's sales cycle definition.
     * GET /integration/salesCycle?companyId=&type=
     */
    async getSalesCycle(params = {}) {
        const query = this._companyQuery(params);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.salesCycle +
                this._buildQuery(query),
        });
    }

    // ---- Company -----------------------------------------------------------

    /**
     * Get company data for the connected Stack company.
     * GET /integration/company?companyId=&type=
     */
    async getCompany(params = {}) {
        const query = this._companyQuery(params);
        return this._get({
            url:
                this.baseUrl + this.URLs.company + this._buildQuery(query),
        });
    }

    /**
     * Get team members for the connected Stack company.
     * GET /integration/company/members?companyId=&type=
     */
    async getTeamMembers(params = {}) {
        const query = this._companyQuery(params);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.companyMembers +
                this._buildQuery(query),
        });
    }
}

module.exports = { Api, DEFAULT_BASE_URL };
