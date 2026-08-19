const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Gong public API client.
 *
 * Gong (gong.io) is a Revenue Intelligence platform that records, transcribes,
 * and analyzes customer-facing conversations (calls, meetings, emails). Its
 * public API is a REST surface authenticated with HTTP Basic auth: an Access
 * Key and an Access Key Secret are combined as `Base64(accessKey:accessKeySecret)`
 * and sent in the `Authorization: Basic <token>` header.
 *
 *   - Create credentials: https://app.gong.io/company/api  (technical admin only)
 *   - Base URL: company-specific, discoverable at
 *     https://app.gong.io/company/api-authentication (e.g. https://us-55616.api.gong.io).
 *     The generic host https://api.gong.io/v2 is the documented default and is
 *     used here unless a `base_url` param overrides it.
 *   - Rate limits: 3 calls/sec, 10,000 calls/day; 429 + Retry-After when exceeded.
 *
 * Docs: https://help.gong.io/apidocs/introduction-2
 *
 * The canonical machine-readable contract lives in ./gong.openapi.yaml — this
 * client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params) {
        super(params);

        // Gong Basic auth = Base64(accessKey:accessKeySecret). We accept the
        // Gong-native names (access_key / access_key_secret) and map them onto
        // BasicAuthRequester's username/password, which build the header.
        this.access_key = get(params, 'access_key', null);
        this.access_key_secret = get(params, 'access_key_secret', null);
        if (this.access_key) this.username = this.access_key;
        if (this.access_key_secret) this.password = this.access_key_secret;

        // Company-specific base URL is supported; default to the documented host.
        this.baseUrl = get(params, 'base_url', null) || 'https://api.gong.io/v2';

        this.URLs = {
            calls: '/calls',
            callById: (callId) => `/calls/${callId}`,
            callsExtensive: '/calls/extensive',
            callsTranscript: '/calls/transcript',
            users: '/users',
            userById: (userId) => `/users/${userId}`,
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['access_key', 'access_key_secret'],
                    properties: {
                        access_key: {
                            type: 'string',
                            title: 'Access Key',
                        },
                        access_key_secret: {
                            type: 'string',
                            title: 'Access Key Secret',
                        },
                    },
                },
                uiSchema: {
                    access_key: {
                        'ui:help':
                            'Create an Access Key under Company Settings → API in Gong (technical administrators only).',
                        'ui:placeholder': 'Your Gong Access Key',
                    },
                    access_key_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'The Access Key Secret shown alongside your Access Key. Sent as Base64(accessKey:accessKeySecret) in the Basic Authorization header.',
                        'ui:placeholder': 'Your Gong Access Key Secret',
                    },
                },
            },
        };
    }

    // ---- Calls --------------------------------------------------------------

    /**
     * List calls that took place in a date range.
     * Query params: fromDateTime, toDateTime (ISO-8601), cursor, workspaceId.
     * Returns a page of call metadata plus a `records.cursor` for pagination.
     */
    async listCalls(params = {}) {
        const query = {};
        if (params.fromDateTime) query.fromDateTime = params.fromDateTime;
        if (params.toDateTime) query.toDateTime = params.toDateTime;
        if (params.cursor) query.cursor = params.cursor;
        if (params.workspaceId) query.workspaceId = params.workspaceId;

        const options = {
            url: this.baseUrl + this.URLs.calls,
            query,
        };
        return this._get(options);
    }

    /** Retrieve a single call's metadata by id. */
    async getCall(callId) {
        const options = {
            url: this.baseUrl + this.URLs.callById(callId),
        };
        return this._get(options);
    }

    /**
     * Retrieve detailed call data by filter. This is the endpoint that carries
     * attendee emails: request `contentSelector.exposedFields.parties: true` and
     * each returned `calls[].parties[]` includes `emailAddress`, `name`,
     * `affiliation` (Internal/External), `speakerId`, `userId`, and `phoneNumber`.
     *
     * body = {
     *   filter: { fromDateTime, toDateTime, callIds, primaryUserIds, workspaceId },
     *   contentSelector: { exposedFields: { parties: true, ... }, context, contextTiming },
     *   cursor
     * }
     */
    async listCallsExtensive(body) {
        const options = {
            url: this.baseUrl + this.URLs.callsExtensive,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    /**
     * Retrieve transcripts for calls. Requires `filter` (by callIds and/or a
     * date range). Returns `callTranscripts[]`, each with a `transcript[]` of
     * monologues keyed by `speakerId` (resolve speakers to emails via the
     * `parties` from listCallsExtensive).
     *
     * body = { filter: { callIds, fromDateTime, toDateTime, workspaceId }, cursor }
     */
    async getTranscripts(body) {
        const options = {
            url: this.baseUrl + this.URLs.callsTranscript,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        return this._post(options);
    }

    // ---- Users --------------------------------------------------------------

    /** List all users. Query params: cursor, includeAvatars. */
    async listUsers(params = {}) {
        const query = {};
        if (params.cursor) query.cursor = params.cursor;
        if (params.includeAvatars !== undefined) {
            query.includeAvatars = params.includeAvatars;
        }
        const options = {
            url: this.baseUrl + this.URLs.users,
            query,
        };
        return this._get(options);
    }

    /** Retrieve a single user by id. */
    async getUser(userId) {
        const options = {
            url: this.baseUrl + this.URLs.userById(userId),
        };
        return this._get(options);
    }

    // ---- Auth check ---------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials. Listing a
     * single user page returns 200 for valid keys; invalid keys return 401,
     * which the requester surfaces as an error.
     */
    async testAuth() {
        return this.listUsers({ includeAvatars: false });
    }
}

module.exports = { Api };
