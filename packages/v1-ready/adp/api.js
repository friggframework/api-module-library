const https = require('https');
const {
    OAuth2Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * ADP Workforce Now API client (Worker Management + Event Notifications).
 *
 * Auth: OAuth 2.0 Client Credentials Grant with mutual TLS.
 *   POST https://accounts.adp.com/auth/oauth/v2/token
 *   Authorization: Basic base64(client_id:client_secret)
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: grant_type=client_credentials
 *   TLS client certificate: ADP-issued X.509 (required on token + API calls)
 *   → Authorization: Bearer <access_token>  (typical TTL 3600s)
 *
 * Base URL: https://api.adp.com
 *
 * Official sources (not invented):
 *   - Worker Management API Guide for ADP Workforce Now
 *     https://marketplace-cdn.adp.com/dev-portal/pdf/protected/Worker_Management_API_Guide_for_ADP_Workforce_Now
 *   - Data Connector App Authorization Process
 *     https://marketplace-cdn.adp.com/dev-portal/pdf/Understanding_the_Data_Connector_App_Authorization_Process
 *   - Event notifications (ESI)
 *     https://marketplace-cdn.adp.com/dev-portal/pdf/ADP_Marketplace_ESI_-_Event_notifications
 *   - Developer Hub: https://developers.adp.com/
 *
 * The curated contract in ./adp.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Partner access: ADP Marketplace / Partner Self Service credentials and an
 * ADP-signed certificate are required. Canonical scopes must be registered
 * in the Consumer Application Registry (CAR) for each use case.
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
        this.ssl_cert =
            get(params, 'ssl_cert', null) || get(params, 'sslCert', null);
        this.ssl_key =
            get(params, 'ssl_key', null) || get(params, 'sslKey', null);
        this.ssl_passphrase =
            get(params, 'ssl_passphrase', null) ||
            get(params, 'sslPassphrase', null);
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'accessToken', null);

        this.baseUrl = 'https://api.adp.com';
        this.baseURL = this.baseUrl;
        this.tokenUri = 'https://accounts.adp.com/auth/oauth/v2/token';

        // Client-credentials tokens are re-minted, not refresh_token rotated.
        this.isRefreshable = true;

        this.URLs = {
            workers: '/hr/v2/workers',
            workersMeta: '/hr/v2/workers/meta',
            workerByOid: (associateOid) => `/hr/v2/workers/${associateOid}`,
            workerDemographics: '/hr/v2/worker-demographics',
            workerDemographicsMeta: '/hr/v2/worker-demographics/meta',
            workerDemographicByOid: (associateOid) =>
                `/hr/v2/worker-demographics/${associateOid}`,
            workerRead: '/events/hr/v1/worker.read',
            workerReadMeta: '/events/hr/v1/worker.read/meta',
            workerHire: '/events/hr/v1/worker.hire',
            workerLegalNameChange: '/events/hr/v1/worker.legal-name.change',
            workerBaseRemunerationChange:
                '/events/hr/v1/worker.work-assignment.base-remuneration.change',
            eventNotificationMessages: '/core/v1/event-notification-messages',
            eventNotificationMessageById: (eventId) =>
                `/core/v1/event-notification-messages/${eventId}`,
            codelist: (tableName) =>
                `/codelists/hr/v3/worker-management/${tableName}/WFN/1`,
        };

        this._configureTlsAgent();
    }

    /**
     * ADP requires the X.509 client certificate on every HTTPS call.
     * Requester forwards `this.agent` to node-fetch.
     */
    _configureTlsAgent() {
        if (!this.ssl_cert || !this.ssl_key) {
            this.agent = undefined;
            return;
        }
        const agentOptions = {
            cert: this.ssl_cert,
            key: this.ssl_key,
            keepAlive: true,
        };
        if (this.ssl_passphrase) {
            agentOptions.passphrase = this.ssl_passphrase;
        }
        this.agent = new https.Agent(agentOptions);
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'ADP Workforce Now Authentication',
                    type: 'object',
                    required: [
                        'client_id',
                        'client_secret',
                        'ssl_cert',
                        'ssl_key',
                    ],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        ssl_cert: {
                            type: 'string',
                            title: 'SSL Certificate (PEM)',
                        },
                        ssl_key: {
                            type: 'string',
                            title: 'SSL Private Key (PEM)',
                        },
                        ssl_passphrase: {
                            type: 'string',
                            title: 'SSL Key Passphrase (optional)',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'OAuth client_id from ADP Partner Self Service / API Central (Data Connector credentials).',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'OAuth client_secret for the same Data Connector credential. Sent as HTTP Basic with client_id to the token endpoint.',
                    },
                    ssl_cert: {
                        'ui:widget': 'textarea',
                        'ui:help':
                            'PEM-encoded X.509 client certificate issued/signed by ADP. Required on token and API calls (mutual TLS).',
                    },
                    ssl_key: {
                        'ui:widget': 'textarea',
                        'ui:help':
                            'PEM-encoded private key matching the SSL certificate.',
                    },
                    ssl_passphrase: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Optional passphrase if the private key is encrypted.',
                    },
                },
            },
        };
    }

    /**
     * ADP token endpoint: form body + Basic auth + mTLS.
     * Official guide uses Authorization: Basic and grant_type=client_credentials.
     *
     * @see https://marketplace-cdn.adp.com/dev-portal/pdf/Understanding_the_Data_Connector_App_Authorization_Process
     */
    async getTokenFromClientCredentials() {
        if (!this.client_id || !this.client_secret) {
            throw new Error(
                'ADP: client_id and client_secret are required to obtain an access token.'
            );
        }
        this._configureTlsAgent();

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const basic = Buffer.from(
            `${this.client_id}:${this.client_secret}`
        ).toString('base64');

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basic}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /** Alias used by Definition / OpenAPI operationId `getToken`. */
    async getToken() {
        return this.getTokenFromClientCredentials();
    }

    /**
     * Client-credentials auth has no refresh_token. Authenticated means we
     * either hold a Bearer token or can mint one from client_id + secret
     * (certificate still required for live calls).
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
                'ADP: client_id and client_secret are required to obtain an access token.'
            );
        }
        await this.getTokenFromClientCredentials();
        return this.access_token;
    }

    async _authedGet(options) {
        await this.ensureAccessToken();
        this._configureTlsAgent();
        return this._get(options);
    }

    async _authedPost(options) {
        await this.ensureAccessToken();
        this._configureTlsAgent();
        return this._post(options);
    }

    async _authedDelete(options) {
        await this.ensureAccessToken();
        this._configureTlsAgent();
        return this._delete(options);
    }

    _absoluteUrl(pathOrUrl) {
        if (!pathOrUrl) {
            throw new Error('ADP: path or URL is required.');
        }
        if (/^https?:\/\//i.test(pathOrUrl)) {
            return pathOrUrl;
        }
        const path = pathOrUrl.startsWith('/')
            ? pathOrUrl
            : `/${pathOrUrl}`;
        return this.baseUrl + path;
    }

    // ---- Workers (Worker Management API) -----------------------------------

    /**
     * GET /hr/v2/workers
     * Scope: /hr/workerInformationManagement/workerManagement/workerProfileManagement/worker.read
     * OData: $top, $skip, $select, $filter; also count=true, asOfDate.
     */
    async listWorkers(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workers,
            query,
            headers: { Accept: 'application/json' },
        });
    }

    /** GET /hr/v2/workers/meta */
    async getWorkersMeta(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workersMeta,
            query,
            headers: { Accept: 'application/json' },
        });
    }

    /** GET /hr/v2/workers/{associate-oid} */
    async getWorker(associateOid, query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workerByOid(associateOid),
            query,
            headers: { Accept: 'application/json' },
        });
    }

    // ---- Worker demographics -----------------------------------------------

    /**
     * GET /hr/v2/worker-demographics
     * Scope: .../workerDemographic.read
     */
    async listWorkerDemographics(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workerDemographics,
            query,
            headers: { Accept: 'application/json' },
        });
    }

    /** GET /hr/v2/worker-demographics/meta */
    async getWorkerDemographicsMeta(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workerDemographicsMeta,
            query,
            headers: { Accept: 'application/json' },
        });
    }

    /** GET /hr/v2/worker-demographics/{aoid} */
    async getWorkerDemographic(associateOid, query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workerDemographicByOid(associateOid),
            query,
            headers: { Accept: 'application/json' },
        });
    }

    // ---- Worker indicative-data read ---------------------------------------

    /** GET /events/hr/v1/worker.read/meta */
    async getWorkerReadMeta() {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workerReadMeta,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * POST /events/hr/v1/worker.read
     * Retrieve a worker using indicative data (e.g. government ID) in the body.
     */
    async readWorker(data) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.workerRead,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: data,
        });
    }

    // ---- Worker writes (event APIs) ----------------------------------------

    /**
     * POST /events/hr/v1/worker.hire
     * Scope: .../lifecycleManagement/worker.hire
     * Note: Worker Management guide marks hire as not supported on WFN Next Gen
     * (use Applicant Onboard V2 there).
     */
    async hireWorker(data) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.workerHire,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: data,
        });
    }

    /** POST /events/hr/v1/worker.legal-name.change */
    async changeWorkerLegalName(data) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.workerLegalNameChange,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: data,
        });
    }

    /** POST /events/hr/v1/worker.work-assignment.base-remuneration.change */
    async changeWorkerBaseRemuneration(data) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.workerBaseRemunerationChange,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: data,
        });
    }

    // ---- Event notification messages (subscription delivery queue) ---------

    /**
     * GET /core/v1/event-notification-messages
     * Poll the subscriber message queue (FIFO). Events must be subscribed via
     * Partner Self Service / API Central — there is no public REST API to
     * create/list/delete webhook subscription configurations.
     */
    async listEventNotificationMessages(query = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.eventNotificationMessages,
            query,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * GET {callback_uri} from an event notification's links[].href
     * (e.g. /events/hr/v1/worker.hire/{eventInstanceId}).
     */
    async getEventNotificationDetails(callbackUri) {
        return this._authedGet({
            url: this._absoluteUrl(callbackUri),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * DELETE /core/v1/event-notification-messages/{eventID}
     * Remove a processed message from the queue.
     */
    async deleteEventNotificationMessage(eventId) {
        return this._authedDelete({
            url: this.baseUrl + this.URLs.eventNotificationMessageById(eventId),
            headers: { Accept: 'application/json' },
        });
    }

    // ---- Codelists ---------------------------------------------------------

    /**
     * GET /codelists/hr/v3/worker-management/{table-name}/WFN/1
     * Scope: .../codeListViewing/codelist.read
     * table-name examples: departments, locations, job titles, business units
     * (see Worker Management guide Chapter 6; path segments may include spaces
     * as published by ADP, e.g. "job titles").
     */
    async getCodelist(tableName) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.codelist(tableName),
            headers: { Accept: 'application/json' },
        });
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * Mints a token if needed, then fetches workers meta (small surface).
     */
    async testAuth() {
        await this.ensureAccessToken();
        return this.getWorkersMeta();
    }
}

module.exports = { Api };
