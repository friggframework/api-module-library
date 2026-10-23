const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Segment Public API + Profile (Unify) API client.
 *
 * Public API auth: Bearer workspace token
 *   Authorization: Bearer <PUBLIC_API_TOKEN>
 *   Base URL: https://api.segmentapis.com
 *   Docs / OpenAPI: https://docs.segmentapis.com/ (v73.6.0)
 *
 * Profile API auth: HTTP Basic with Unify access token as username and empty
 * password (official docs). Per-space token + space id.
 *   Base URL: https://profiles.segment.com/v1/spaces/{spaceId}
 *   Docs: https://www.twilio.com/docs/segment/unify/profile-api
 *
 * This class's `baseUrl` is the Public API host so segment.openapi.yaml
 * servers[0].url stays in sync. Profile calls use `profileBaseUrl`.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        const rawPublic =
            get(params, 'access_token', null) ||
            get(params, 'public_api_token', null) ||
            get(params, 'api_key', null);
        const publicToken = rawPublic
            ? String(rawPublic).replace(/^Bearer\s+/i, '').trim()
            : null;

        this.access_token = publicToken;
        this.public_api_token = publicToken;
        // ApiKeyRequester.addAuthHeaders sets headers[api_key_name] = api_key.
        // We override addAuthHeaders to emit Bearer without persisting the prefix.
        this.api_key_name = 'Authorization';
        this.api_key = publicToken;

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            process.env.SEGMENT_PUBLIC_API_BASE_URL ||
            'https://api.segmentapis.com';

        this.profile_api_token =
            get(params, 'profile_api_token', null) ||
            process.env.SEGMENT_PROFILE_API_TOKEN ||
            null;
        this.space_id =
            get(params, 'space_id', null) ||
            process.env.SEGMENT_SPACE_ID ||
            null;
        this.profileBaseUrl =
            get(params, 'profileBaseUrl', null) ||
            process.env.SEGMENT_PROFILE_API_BASE_URL ||
            'https://profiles.segment.com/v1';

        this.URLs = {
            workspace: '/',
            sources: '/sources',
            source: (sourceId) => `/sources/${sourceId}`,
            sourceConnectedDestinations: (sourceId) =>
                `/sources/${sourceId}/connected-destinations`,
            destinations: '/destinations',
            destination: (destinationId) => `/destinations/${destinationId}`,
            destinationSubscriptions: (destinationId) =>
                `/destinations/${destinationId}/subscriptions`,
            destinationSubscription: (destinationId, id) =>
                `/destinations/${destinationId}/subscriptions/${id}`,
            warehouses: '/warehouses',
            warehouse: (warehouseId) => `/warehouses/${warehouseId}`,
            trackingPlans: '/tracking-plans',
            trackingPlan: (trackingPlanId) =>
                `/tracking-plans/${trackingPlanId}`,
            functions: '/functions',
            functionById: (functionId) => `/functions/${functionId}`,
            spaces: '/spaces',
        };
    }

    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.access_token || this.api_key) {
            const token = this.access_token || this.api_key;
            h.Authorization = `Bearer ${token}`;
        }
        return h;
    }

    setPublicApiToken(token) {
        const cleaned = token
            ? String(token).replace(/^Bearer\s+/i, '').trim()
            : null;
        this.access_token = cleaned;
        this.public_api_token = cleaned;
        this.api_key = cleaned;
    }

    setProfileAuth({ profile_api_token, space_id } = {}) {
        if (profile_api_token !== undefined) {
            this.profile_api_token = profile_api_token;
        }
        if (space_id !== undefined) {
            this.space_id = space_id;
        }
    }

    /**
     * Build Public API list query strings. Official OpenAPI documents the
     * pagination object with example `pagination.count=2` (dot-encoded flat
     * query keys). See https://docs.segmentapis.com/ tag Sources.
     */
    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (key === 'pagination' && typeof value === 'object') {
                if (value.count !== undefined && value.count !== null) {
                    usp.append('pagination.count', String(value.count));
                }
                if (value.cursor !== undefined && value.cursor !== null) {
                    usp.append('pagination.cursor', String(value.cursor));
                }
                continue;
            }
            if (typeof value === 'object') {
                usp.append(key, JSON.stringify(value));
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _profileAuthHeader() {
        if (!this.profile_api_token) {
            throw new Error(
                'Segment Profile API: profile_api_token is required (HTTP Basic username, empty password).'
            );
        }
        const token = Buffer.from(
            `${this.profile_api_token}:`,
            'utf8'
        ).toString('base64');
        return `Basic ${token}`;
    }

    _profileSpaceBase() {
        if (!this.space_id) {
            throw new Error(
                'Segment Profile API: space_id is required in the request path.'
            );
        }
        return `${this.profileBaseUrl}/spaces/${this.space_id}`;
    }

    async _profileGet(path, params = {}) {
        // Validate auth before path so callers missing the token see that first.
        const authorization = this._profileAuthHeader();
        const url =
            this._profileSpaceBase() + path + this._buildQuery(params);
        return this._get({
            url,
            headers: {
                Authorization: authorization,
                Accept: 'application/json',
            },
        });
    }

    // ---- Public API: Workspace ------------------------------------------------

    /**
     * Get Workspace for the token.
     * GET /
     * Official operationId: getWorkspace
     */
    async getWorkspace() {
        return this._get({ url: this.baseUrl + this.URLs.workspace });
    }

    // ---- Public API: Sources --------------------------------------------------

    /**
     * List Sources.
     * GET /sources
     * Official operationId: listSources
     * @param {object} [params]
     * @param {{count?: number, cursor?: string}} [params.pagination]
     */
    async listSources(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.sources + this._buildQuery(params),
        });
    }

    /**
     * Get a Source.
     * GET /sources/{sourceId}
     * Official operationId: getSource
     */
    async getSource(sourceId) {
        return this._get({
            url: this.baseUrl + this.URLs.source(sourceId),
        });
    }

    /**
     * List Destinations connected to a Source.
     * GET /sources/{sourceId}/connected-destinations
     * Official operationId: listConnectedDestinationsFromSource
     */
    async listConnectedDestinationsFromSource(sourceId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.sourceConnectedDestinations(sourceId) +
                this._buildQuery(params),
        });
    }

    // ---- Public API: Destinations ---------------------------------------------

    /**
     * List Destinations.
     * GET /destinations
     * Official operationId: listDestinations
     */
    async listDestinations(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.destinations +
                this._buildQuery(params),
        });
    }

    /**
     * Get a Destination.
     * GET /destinations/{destinationId}
     * Official operationId: getDestination
     */
    async getDestination(destinationId) {
        return this._get({
            url: this.baseUrl + this.URLs.destination(destinationId),
        });
    }

    /**
     * List subscriptions for a Destination (Actions / webhook wiring).
     * GET /destinations/{destinationId}/subscriptions
     * Official operationId: listSubscriptionsFromDestination
     * Alpha; requires Destination Subscriptions feature.
     */
    async listSubscriptionsFromDestination(destinationId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.destinationSubscriptions(destinationId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a Destination subscription.
     * GET /destinations/{destinationId}/subscriptions/{id}
     * Official operationId: getSubscriptionFromDestination
     */
    async getSubscriptionFromDestination(destinationId, id) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.destinationSubscription(destinationId, id),
        });
    }

    // ---- Public API: Warehouses -----------------------------------------------

    /**
     * List Warehouses.
     * GET /warehouses
     * Official operationId: listWarehouses
     */
    async listWarehouses(params = {}) {
        return this._get({
            url:
                this.baseUrl + this.URLs.warehouses + this._buildQuery(params),
        });
    }

    /**
     * Get a Warehouse.
     * GET /warehouses/{warehouseId}
     * Official operationId: getWarehouse
     */
    async getWarehouse(warehouseId) {
        return this._get({
            url: this.baseUrl + this.URLs.warehouse(warehouseId),
        });
    }

    // ---- Public API: Tracking Plans -------------------------------------------

    /**
     * List Tracking Plans.
     * GET /tracking-plans
     * Official operationId: listTrackingPlans
     * Requires Protocols.
     */
    async listTrackingPlans(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.trackingPlans +
                this._buildQuery(params),
        });
    }

    /**
     * Get a Tracking Plan.
     * GET /tracking-plans/{trackingPlanId}
     * Official operationId: getTrackingPlan
     */
    async getTrackingPlan(trackingPlanId) {
        return this._get({
            url: this.baseUrl + this.URLs.trackingPlan(trackingPlanId),
        });
    }

    // ---- Public API: Functions (Destination Functions / webhook-style) --------

    /**
     * List Functions.
     * GET /functions
     * Official operationId: listFunctions
     */
    async listFunctions(params = {}) {
        return this._get({
            url:
                this.baseUrl + this.URLs.functions + this._buildQuery(params),
        });
    }

    /**
     * Get a Function.
     * GET /functions/{functionId}
     * Official operationId: getFunction
     */
    async getFunction(functionId) {
        return this._get({
            url: this.baseUrl + this.URLs.functionById(functionId),
        });
    }

    // ---- Public API: Spaces (Unify space ids for Profile API) -----------------

    /**
     * List Spaces.
     * GET /spaces
     * Official operationId: listSpaces
     */
    async listSpaces(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.spaces + this._buildQuery(params),
        });
    }

    // ---- Profile API (Unify) --------------------------------------------------

    /**
     * Get user profile traits.
     * GET /v1/spaces/{spaceId}/collections/users/profiles/{externalId}/traits
     * Docs: https://www.twilio.com/docs/segment/unify/profile-api
     * @param {string} externalId e.g. "user_id:123" or "email:a@b.com"
     * @param {object} [params] limit, include, class, next/cursor
     */
    async getProfileTraits(externalId, params = {}) {
        return this._profileGet(
            `/collections/users/profiles/${encodeURIComponent(externalId)}/traits`,
            params
        );
    }

    /**
     * Get user profile events (up to ~14 days of history per official docs).
     * GET .../collections/users/profiles/{externalId}/events
     */
    async getProfileEvents(externalId, params = {}) {
        return this._profileGet(
            `/collections/users/profiles/${encodeURIComponent(externalId)}/events`,
            params
        );
    }

    /**
     * Get user profile external IDs.
     * GET .../collections/users/profiles/{externalId}/external_ids
     */
    async getProfileExternalIds(externalId, params = {}) {
        return this._profileGet(
            `/collections/users/profiles/${encodeURIComponent(externalId)}/external_ids`,
            params
        );
    }

    /**
     * Get account (group) profile traits.
     * GET .../collections/accounts/profiles/{externalId}/traits
     * e.g. externalId = "group_id:12345"
     */
    async getAccountProfileTraits(externalId, params = {}) {
        return this._profileGet(
            `/collections/accounts/profiles/${encodeURIComponent(externalId)}/traits`,
            params
        );
    }
}

module.exports = { Api };
