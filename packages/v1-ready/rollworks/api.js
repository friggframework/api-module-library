const { OAuth2Requester, RequiredPropertyError, get } = require('@friggframework/core');

/**
 * RollWorks / AdRoll ABM (NextRoll) API client.
 *
 * Auth: OAuth 2.0 authorization-code grant. Access tokens are sent as
 *   Authorization: Bearer {ACCESS_TOKEN}
 * Refresh tokens rotate on use and expire after one year; access tokens expire
 * after 24 hours. The only documented scope is `all`.
 *
 * Base URL: https://services.adroll.com
 * Docs:
 *   - https://apidocs.nextroll.com/guides/get-started-rollworks.html
 *   - https://apidocs.nextroll.com/guides/oauth.html
 *   - https://apidocs.nextroll.com/audience-api/reference.html
 *   - https://apidocs.nextroll.com/crud-api/reference.html
 *
 * The canonical machine-readable contract lives in ./rollworks.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Most Audience API calls require an `advertisable_eid` query parameter. Set it
 * once via `setAdvertisableEid` / constructor, or pass it per call.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://services.adroll.com';

        // OAuth2Requester loads client_id / client_secret / redirect_uri / scope
        // from Auther params (Definition.env). Fall back to process.env only
        // when those are unset (local scripts).
        this.client_id =
            this.client_id || process.env.ROLLWORKS_CLIENT_ID || null;
        this.client_secret =
            this.client_secret || process.env.ROLLWORKS_CLIENT_SECRET || null;
        this.redirect_uri =
            this.redirect_uri ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/rollworks`
                : null);
        this.scope =
            this.scope ||
            this.scopes ||
            process.env.ROLLWORKS_SCOPE ||
            process.env.ROLLWORKS_SCOPES ||
            'all';

        this.URLs = {
            getOrganization: '/api/v1/organization/get',
            listAdvertisables: '/api/v1/organization/get_advertisables',
            targetAccounts: '/audience/v1/target_accounts',
            targetAccountById: (talEid) =>
                `/audience/v1/target_accounts/${talEid}`,
            targetAccountItems: (talEid, tierEid = 'all') =>
                `/audience/v1/target_accounts/${talEid}/tiers/${tierEid}/items`,
        };

        this.authorizationUri = encodeURI(
            `https://services.adroll.com/auth/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&state=${this.state || ''}`
        );
        this.tokenUri = 'https://services.adroll.com/auth/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.advertisable_eid = get(params, 'advertisable_eid', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    setAdvertisableEid(advertisable_eid) {
        this.advertisable_eid = advertisable_eid;
    }

    /**
     * Resolve advertisable_eid from an explicit override, then the instance.
     * Throws RequiredPropertyError when still missing — Audience endpoints
     * require it as a query parameter.
     */
    resolveAdvertisableEid(override) {
        const advertisableEid =
            override !== undefined && override !== null && override !== ''
                ? override
                : this.advertisable_eid;
        if (
            advertisableEid === undefined ||
            advertisableEid === null ||
            advertisableEid === ''
        ) {
            throw new RequiredPropertyError({
                parent: this,
                key: 'advertisable_eid',
            });
        }
        return advertisableEid;
    }

    _withAdvertisableQuery(path, advertisableEid, extraQuery = {}) {
        const usp = new URLSearchParams();
        usp.set('advertisable_eid', advertisableEid);
        for (const [key, value] of Object.entries(extraQuery)) {
            if (value === undefined || value === null) continue;
            usp.set(key, String(value));
        }
        const qs = usp.toString();
        return `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    }

    // ---- Organization / identity -------------------------------------------

    /**
     * Fetch the authenticated organization.
     * GET /api/v1/organization/get
     *
     * Documented fields: eid, name, created_date. Some responses historically
     * wrapped the org under `results`; callers should prefer
     * `response.results || response`.
     */
    async getOrganization(params = {}) {
        const query = {};
        if (params.organization) query.organization = params.organization;
        return this._get({
            url: this.baseUrl + this.URLs.getOrganization,
            query,
        });
    }

    /**
     * List advertisables for the organization.
     * GET /api/v1/organization/get_advertisables
     * Response: { results: [ Advertisable, ... ] }
     */
    async listAdvertisables(params = {}) {
        const query = {};
        if (params.organization) query.organization = params.organization;
        return this._get({
            url: this.baseUrl + this.URLs.listAdvertisables,
            query,
        });
    }

    // ---- Target Account Lists ----------------------------------------------

    /**
     * List Target Account Lists for an advertisable.
     * GET /audience/v1/target_accounts?advertisable_eid=...
     */
    async listTargetAccounts(params = {}) {
        const advertisableEid = this.resolveAdvertisableEid(
            params.advertisable_eid
        );
        const extra = {};
        if (params.scoring_model_id)
            extra.scoring_model_id = params.scoring_model_id;
        if (params.include_deleted !== undefined)
            extra.include_deleted = params.include_deleted;
        return this._get({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccounts,
                advertisableEid,
                extra
            ),
        });
    }

    /**
     * Get a single Target Account List.
     * GET /audience/v1/target_accounts/{tal_eid}?advertisable_eid=...
     */
    async getTargetAccount(talEid, params = {}) {
        const id = talEid || get(params, 'talEid', null) || get(params, 'targetAccountId', null);
        if (!id) {
            throw new RequiredPropertyError({ parent: this, key: 'talEid' });
        }
        const advertisableEid = this.resolveAdvertisableEid(
            params.advertisable_eid
        );
        return this._get({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccountById(id),
                advertisableEid
            ),
        });
    }

    /**
     * Create a Target Account List.
     * POST /audience/v1/target_accounts?advertisable_eid=...
     * Body: { name, domains?, advertisable_eid, ... }
     */
    async createTargetAccount(data = {}) {
        const advertisableEid = this.resolveAdvertisableEid(
            data.advertisable_eid
        );
        const body = {
            ...data,
            advertisable_eid: advertisableEid,
        };
        return this._post({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccounts,
                advertisableEid
            ),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a Target Account List.
     * POST /audience/v1/target_accounts/{tal_eid}?advertisable_eid=...
     */
    async updateTargetAccount(talEid, data = {}) {
        if (!talEid) {
            throw new RequiredPropertyError({ parent: this, key: 'talEid' });
        }
        const advertisableEid = this.resolveAdvertisableEid(
            data.advertisable_eid
        );
        const { advertisable_eid: _ignored, ...rest } = data;
        return this._post({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccountById(talEid),
                advertisableEid
            ),
            headers: { 'Content-Type': 'application/json' },
            body: rest,
        });
    }

    /**
     * Delete a Target Account List.
     * DELETE /audience/v1/target_accounts/{tal_eid}?advertisable_eid=...
     */
    async deleteTargetAccount(talEid, params = {}) {
        if (!talEid) {
            throw new RequiredPropertyError({ parent: this, key: 'talEid' });
        }
        const advertisableEid = this.resolveAdvertisableEid(
            params.advertisable_eid
        );
        const extra = {};
        if (params.force !== undefined) extra.force = params.force;
        return this._delete({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccountById(talEid),
                advertisableEid,
                extra
            ),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * List domains (items) in a Target Account List tier (default tier: `all`).
     * GET /audience/v1/target_accounts/{tal_eid}/tiers/{tier}/items
     */
    async listTargetAccountItems(talEid, params = {}) {
        if (!talEid) {
            throw new RequiredPropertyError({ parent: this, key: 'talEid' });
        }
        const advertisableEid = this.resolveAdvertisableEid(
            params.advertisable_eid
        );
        const tierEid = params.tierEid || params.ta_tier_eid || 'all';
        return this._get({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccountItems(talEid, tierEid),
                advertisableEid
            ),
        });
    }

    /**
     * Upsert domains into a Target Account List tier (default tier: `all`).
     * POST /audience/v1/target_accounts/{tal_eid}/tiers/{tier}/items
     * Body: { items: [ { domain }, ... ] }
     *
     * Convenience: accepts `domains: string[]` and maps them to `items`.
     */
    async addTargetAccountItems(talEid, data = {}) {
        if (!talEid) {
            throw new RequiredPropertyError({ parent: this, key: 'talEid' });
        }
        const advertisableEid = this.resolveAdvertisableEid(
            data.advertisable_eid
        );
        const tierEid = data.tierEid || data.ta_tier_eid || 'all';
        let items = data.items;
        if (!items && Array.isArray(data.domains)) {
            items = data.domains.map((domain) => ({ domain }));
        }
        return this._post({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccountItems(talEid, tierEid),
                advertisableEid
            ),
            headers: { 'Content-Type': 'application/json' },
            body: { items },
        });
    }

    /**
     * Remove domains from a Target Account List tier (default tier: `all`).
     * DELETE /audience/v1/target_accounts/{tal_eid}/tiers/{tier}/items
     * Body: { domains: string[] }
     */
    async removeTargetAccountItems(talEid, data = {}) {
        if (!talEid) {
            throw new RequiredPropertyError({ parent: this, key: 'talEid' });
        }
        const advertisableEid = this.resolveAdvertisableEid(
            data.advertisable_eid
        );
        const tierEid = data.tierEid || data.ta_tier_eid || 'all';
        const { advertisable_eid: _a, tierEid: _t, ta_tier_eid: _tt, ...body } =
            data;
        return this._delete({
            url: this._withAdvertisableQuery(
                this.URLs.targetAccountItems(talEid, tierEid),
                advertisableEid
            ),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }
}

module.exports = { Api };
