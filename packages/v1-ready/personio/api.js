const crypto = require('crypto');
const {
    OAuth2Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Personio (personio.com) public API client — Personnel Data / v2 surface.
 *
 * Auth: OAuth 2.0 Client Credentials Grant.
 *   POST https://api.personio.de/v2/auth/token
 *   Content-Type: application/x-www-form-urlencoded
 *   grant_type=client_credentials&client_id=…&client_secret=…
 *   → Authorization: Bearer <access_token>  (default TTL 24h)
 *
 * Base URL: https://api.personio.de
 * Docs: https://developer.personio.de/
 * OpenAPI: https://developer.personio.de/openapi
 *
 * The curated contract in ./personio.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super({
            ...params,
            grant_type: 'client_credentials',
        });

        this.client_id =
            get(params, 'client_id', null) || get(params, 'clientId', null);
        this.client_secret =
            get(params, 'client_secret', null) ||
            get(params, 'clientSecret', null);
        this.company_id =
            get(params, 'company_id', null) || get(params, 'companyId', null);
        this.scope = get(params, 'scope', null);
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'accessToken', null);

        this.baseUrl = 'https://api.personio.de';
        this.baseURL = this.baseUrl;
        this.tokenUri = `${this.baseUrl}/v2/auth/token`;

        // Client-credentials tokens are re-minted, not refresh_token rotated.
        this.isRefreshable = true;

        this.URLs = {
            persons: '/v2/persons',
            personById: (id) => `/v2/persons/${id}`,
            absencePeriods: '/v2/absence-periods',
            absencePeriodById: (id) => `/v2/absence-periods/${id}`,
            absenceTypes: '/v2/absence-types',
            absenceTypeById: (id) => `/v2/absence-types/${id}`,
            attendancePeriods: '/v2/attendance-periods',
            attendancePeriodById: (id) => `/v2/attendance-periods/${id}`,
            webhooks: '/v2/webhooks',
            webhookById: (id) => `/v2/webhooks/${id}`,
            webhookSigningSecret: (id) => `/v2/webhooks/${id}/signing-secret`,
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Personio Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret', 'company_id'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        company_id: {
                            type: 'string',
                            title: 'Company ID',
                        },
                        scope: {
                            type: 'string',
                            title: 'Scope (optional)',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'Marketplace → Connected integrations → Create custom integration. Copy the Client ID.',
                        'ui:placeholder': 'papi-…',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Client Secret from the same custom integration credential. Exchanged for a Bearer token via POST /v2/auth/token.',
                        'ui:placeholder': 'Your Client Secret',
                    },
                    company_id: {
                        'ui:help':
                            'Personio company id. Matches `company_id` on webhook payloads and is used as the Frigg entity externalId for tenant routing.',
                        'ui:placeholder': 'e.g. 27277',
                    },
                    scope: {
                        'ui:help':
                            'Optional space-delimited scopes. Omit to receive all scopes granted to the credential.',
                        'ui:placeholder': 'personio:persons:read personio:webhooks:write',
                    },
                },
            },
        };
    }

    /**
     * Personio requires application/x-www-form-urlencoded (not JSON) on the
     * token endpoint. The core OAuth2Requester default posts JSON + audience;
     * override to match the official contract.
     *
     * @see https://developer.personio.de/reference/post_v2-auth-token
     */
    async getTokenFromClientCredentials() {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        if (this.scope) {
            params.append('scope', this.scope);
        }

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /** Alias used by Definition / callers that expect a Personio-shaped getToken. */
    async getToken() {
        return this.getTokenFromClientCredentials();
    }

    /**
     * Client-credentials auth has no refresh_token. Authenticated means we
     * either hold a Bearer token or can mint one from client_id + secret.
     */
    isAuthenticated() {
        return !!(
            this.access_token ||
            (this.client_id && this.client_secret)
        );
    }

    async ensureAccessToken() {
        const skewMs = 60 * 1000;
        if (
            this.access_token &&
            this.accessTokenExpire &&
            Date.now() < this.accessTokenExpire.getTime() - skewMs
        ) {
            return this.access_token;
        }
        if (!this.client_id || !this.client_secret) {
            throw new Error(
                'Personio: client_id and client_secret are required to obtain an access token.'
            );
        }
        await this.getTokenFromClientCredentials();
        return this.access_token;
    }

    async _authedGet(options) {
        await this.ensureAccessToken();
        return this._get(options);
    }

    async _authedPost(options) {
        await this.ensureAccessToken();
        return this._post(options);
    }

    async _authedPatch(options) {
        await this.ensureAccessToken();
        return this._patch(options);
    }

    async _authedDelete(options) {
        await this.ensureAccessToken();
        return this._delete(options);
    }

    // ---- Persons -----------------------------------------------------------

    /** GET /v2/persons — list persons (personio:persons:read). */
    async listPersons(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.persons,
            query,
        });
    }

    /** GET /v2/persons/{id} — retrieve a person. */
    async getPerson(id) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.personById(id),
        });
    }

    /** POST /v2/persons — create a person (+ employment). */
    async createPerson(data) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.persons,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PATCH /v2/persons/{person_id} — update a person. */
    async updatePerson(personId, data) {
        return this._authedPatch({
            url: this.baseUrl + this.URLs.personById(personId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /v2/persons/{person_id} — delete a person. */
    async deletePerson(personId) {
        return this._authedDelete({
            url: this.baseUrl + this.URLs.personById(personId),
        });
    }

    // ---- Absence periods ---------------------------------------------------

    /** GET /v2/absence-periods */
    async listAbsencePeriods(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.absencePeriods,
            query,
        });
    }

    /** GET /v2/absence-periods/{id} */
    async getAbsencePeriod(id) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.absencePeriodById(id),
        });
    }

    /** POST /v2/absence-periods */
    async createAbsencePeriod(data, query = {}) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.absencePeriods,
            headers: { 'Content-Type': 'application/json' },
            body: data,
            query,
        });
    }

    /** PATCH /v2/absence-periods/{id} */
    async updateAbsencePeriod(id, data, query = {}) {
        return this._authedPatch({
            url: this.baseUrl + this.URLs.absencePeriodById(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
            query,
        });
    }

    /** DELETE /v2/absence-periods/{id} */
    async deleteAbsencePeriod(id) {
        return this._authedDelete({
            url: this.baseUrl + this.URLs.absencePeriodById(id),
        });
    }

    /** GET /v2/absence-types */
    async listAbsenceTypes(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.absenceTypes,
            query,
        });
    }

    /** GET /v2/absence-types/{id} */
    async getAbsenceType(id) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.absenceTypeById(id),
        });
    }

    // ---- Attendance periods ------------------------------------------------

    /** GET /v2/attendance-periods */
    async listAttendancePeriods(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.attendancePeriods,
            query,
        });
    }

    /** GET /v2/attendance-periods/{id} */
    async getAttendancePeriod(id) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.attendancePeriodById(id),
        });
    }

    /** POST /v2/attendance-periods */
    async createAttendancePeriod(data, query = {}) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.attendancePeriods,
            headers: { 'Content-Type': 'application/json' },
            body: data,
            query,
        });
    }

    /** PATCH /v2/attendance-periods/{id} */
    async updateAttendancePeriod(id, data, query = {}) {
        return this._authedPatch({
            url: this.baseUrl + this.URLs.attendancePeriodById(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
            query,
        });
    }

    /** DELETE /v2/attendance-periods/{id} */
    async deleteAttendancePeriod(id) {
        return this._authedDelete({
            url: this.baseUrl + this.URLs.attendancePeriodById(id),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /** GET /v2/webhooks */
    async listWebhooks(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.webhooks,
            query,
        });
    }

    /** GET /v2/webhooks/{id} */
    async getWebhook(id) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /** POST /v2/webhooks */
    async createWebhook(data) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PATCH /v2/webhooks/{id} */
    async updateWebhook(id, data) {
        return this._authedPatch({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /v2/webhooks/{id} */
    async deleteWebhook(id) {
        return this._authedDelete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /** POST /v2/webhooks/{id}/signing-secret */
    async rotateWebhookSigningSecret(id, data = undefined) {
        const options = {
            url: this.baseUrl + this.URLs.webhookSigningSecret(id),
            headers: { 'Content-Type': 'application/json' },
        };
        if (data !== undefined) {
            options.body = data;
        }
        return this._authedPost(options);
    }

    /**
     * Verify a Personio webhook delivery signature (offline — no HTTP).
     *
     * Headers: X-Personio-Webhook-Timestamp, X-Personio-Webhook-Signature
     * (comma-separated hex HMACs), optional X-Personio-Webhook-Signature-Key-Ids.
     * Signed string: `{timestamp}.{raw_body}` with HMAC-SHA256(secret, …).
     * Secret is used verbatim (no decoding). 5-minute timestamp skew recommended.
     *
     * @see https://developer.personio.de/docs/webhooks
     *
     * @param {Object} args
     * @param {string|Buffer} args.rawBody - Exact delivery body bytes/string
     * @param {Object} args.headers - Request headers (any case)
     * @param {string|string[]} args.secret - Active secret, or [active, retiring]
     * @param {number} [args.toleranceMs=300000] - Max timestamp skew
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({
        rawBody,
        headers = {},
        secret,
        toleranceMs = 5 * 60 * 1000,
    }) {
        const getHeader = (name) => {
            if (!headers || typeof headers !== 'object') return undefined;
            if (headers[name] !== undefined) return headers[name];
            const lower = name.toLowerCase();
            if (headers[lower] !== undefined) return headers[lower];
            for (const key of Object.keys(headers)) {
                if (key.toLowerCase() === lower) return headers[key];
            }
            return undefined;
        };

        const secrets = (Array.isArray(secret) ? secret : [secret]).filter(
            (s) => typeof s === 'string' && s.length > 0
        );
        if (!secrets.length) {
            return { valid: false, reason: 'missing signing secret' };
        }

        const timestamp = getHeader('X-Personio-Webhook-Timestamp');
        const signatureHeader = getHeader('X-Personio-Webhook-Signature');
        if (!timestamp) {
            return {
                valid: false,
                reason: 'missing X-Personio-Webhook-Timestamp',
            };
        }
        if (!signatureHeader) {
            return {
                valid: false,
                reason: 'missing X-Personio-Webhook-Signature',
            };
        }

        const tsMs = Date.parse(timestamp);
        if (Number.isNaN(tsMs)) {
            return { valid: false, reason: 'invalid timestamp' };
        }
        if (Math.abs(Date.now() - tsMs) > toleranceMs) {
            return { valid: false, reason: 'timestamp outside tolerance' };
        }

        const body =
            Buffer.isBuffer(rawBody)
                ? rawBody.toString('utf8')
                : rawBody == null
                  ? ''
                  : String(rawBody);
        const provided = String(signatureHeader)
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        const signed = `${timestamp}.${body}`;
        for (const sec of secrets) {
            const expected = crypto
                .createHmac('sha256', sec)
                .update(signed, 'utf8')
                .digest('hex');
            for (const sig of provided) {
                try {
                    const a = Buffer.from(expected, 'utf8');
                    const b = Buffer.from(sig, 'utf8');
                    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
                        return { valid: true };
                    }
                } catch (_err) {
                    // keep trying
                }
            }
        }
        return { valid: false, reason: 'signature mismatch' };
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * Mints a token if needed, then lists a page of persons.
     */
    async testAuth() {
        await this.ensureAccessToken();
        return this.listPersons({ limit: 1 });
    }
}

module.exports = { Api };
