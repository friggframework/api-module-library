const {
    BasicAuthRequester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Amplitude Analytics API client.
 *
 * Covers the Dashboard REST API, Export API, Behavioral Cohorts API, and
 * User Profile API. Auth is HTTP Basic with the project API key as username
 * and the project secret key as password:
 *
 *   Authorization: Basic base64(api_key:secret_key)
 *
 * Region-aware hosts (Dashboard / Export / Cohorts):
 *   US / default → https://amplitude.com
 *   EU           → https://analytics.eu.amplitude.com
 *
 * User Profile API (Enterprise; not available in EU):
 *   https://profile-api.amplitude.com
 *
 * Docs:
 *   https://amplitude.com/docs/apis/authentication
 *   https://amplitude.com/docs/apis/analytics/dashboard-rest
 *   https://amplitude.com/docs/apis/analytics/export
 *   https://amplitude.com/docs/apis/analytics/behavioral-cohorts
 *   https://amplitude.com/docs/apis/analytics/user-profile
 *   https://amplitude.com/openapi.json
 *
 * The curated contract lives in ./amplitude.openapi.yaml — this client
 * mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
const REGION_HOSTS = {
    us: 'https://amplitude.com',
    eu: 'https://analytics.eu.amplitude.com',
};

const DEFAULT_PROFILE_BASE_URL = 'https://profile-api.amplitude.com';

class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        // Amplitude Basic auth = Base64(api_key:secret_key). Accept common
        // aliases and map onto BasicAuthRequester's username/password.
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'username', null);
        this.secret_key =
            get(params, 'secret_key', null) ||
            get(params, 'secretKey', null) ||
            get(params, 'api_secret', null) ||
            get(params, 'password', null);
        if (this.api_key) this.username = this.api_key;
        if (this.secret_key) this.password = this.secret_key;

        this.region = String(get(params, 'region', 'us') || 'us').toLowerCase();
        this.baseUrl =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            REGION_HOSTS[this.region] ||
            REGION_HOSTS.us;

        this.profileBaseUrl =
            get(params, 'profile_base_url', null) ||
            get(params, 'profileBaseUrl', null) ||
            DEFAULT_PROFILE_BASE_URL;

        this.URLs = {
            eventSegmentation: '/api/2/events/segmentation',
            userActivity: '/api/2/useractivity',
            userSearch: '/api/2/usersearch',
            export: '/api/2/export',
            eventsList: '/api/2/events/list',
            cohorts: '/api/3/cohorts',
            cohortExportRequest: (cohortId) =>
                `/api/5/cohorts/request/${cohortId}`,
            cohortExportStatus: (requestId) =>
                `/api/5/cohorts/request-status/${requestId}`,
            cohortExportFile: (requestId) =>
                `/api/5/cohorts/request/${requestId}/file`,
            userProfile: '/v1/userprofile',
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['api_key', 'secret_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        secret_key: {
                            type: 'string',
                            title: 'Secret Key',
                        },
                        region: {
                            type: 'string',
                            title: 'Region',
                            enum: ['us', 'eu'],
                            default: 'us',
                        },
                        base_url: {
                            type: 'string',
                            title: 'Base URL override',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:help':
                            'Project API key from Amplitude → Settings → Projects → General. Used as the Basic-auth username.',
                        'ui:placeholder': 'Your Amplitude API key',
                    },
                    secret_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Project secret key from the same Project settings page. Sent as Base64(api_key:secret_key) in the Authorization header.',
                        'ui:placeholder': 'Your Amplitude secret key',
                    },
                    region: {
                        'ui:help':
                            'US (https://amplitude.com) or EU (https://analytics.eu.amplitude.com). User Profile API is US-only.',
                    },
                    base_url: {
                        'ui:help':
                            'Optional override for the Dashboard REST / Export / Cohorts host.',
                    },
                },
            },
        };
    }

    setRegion(region) {
        this.region = String(region || 'us').toLowerCase();
        if (REGION_HOSTS[this.region]) {
            this.baseUrl = REGION_HOSTS[this.region];
        }
        return this;
    }

    setBaseUrl(baseUrl) {
        if (baseUrl) this.baseUrl = baseUrl;
        return this;
    }

    _pickQuery(params = {}, keys = []) {
        const query = {};
        for (const key of keys) {
            if (params[key] !== undefined && params[key] !== null) {
                query[key] = params[key];
            }
        }
        return query;
    }

    // ---- Dashboard REST ----------------------------------------------------

    /**
     * Event segmentation.
     * GET /api/2/events/segmentation
     * Required query: e (event JSON string), start, end (YYYYMMDD).
     */
    async getEventSegmentation(params = {}) {
        const query = this._pickQuery(params, [
            'e',
            'e2',
            'start',
            'end',
            'm',
            'i',
            's',
            'g',
            'limit',
            'n',
            'formula',
            'rollingWindow',
            'rollingAverage',
            'g2',
        ]);
        return this._get({
            url: this.baseUrl + this.URLs.eventSegmentation,
            query,
        });
    }

    /**
     * User activity stream for an Amplitude ID.
     * GET /api/2/useractivity
     * Required query: user (Amplitude ID).
     */
    async getUserActivity(params = {}) {
        const query = this._pickQuery(params, [
            'user',
            'offset',
            'limit',
            'direction',
        ]);
        return this._get({
            url: this.baseUrl + this.URLs.userActivity,
            query,
        });
    }

    /**
     * Search users by Amplitude ID, device ID, user ID, or prefix.
     * GET /api/2/usersearch
     * Required query: user
     */
    async searchUsers(params = {}) {
        const query = this._pickQuery(params, ['user']);
        return this._get({
            url: this.baseUrl + this.URLs.userSearch,
            query,
        });
    }

    /**
     * List event types defined for the project.
     * GET /api/2/events/list
     */
    async listEvents(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.eventsList,
            query: this._pickQuery(params, []),
        });
    }

    // ---- Export ------------------------------------------------------------

    /**
     * Export raw events as a ZIP of JSON lines.
     * GET /api/2/export
     * Required query: start, end (YYYYMMDDTHH, UTC server_upload_time).
     */
    async exportEvents(params = {}) {
        const query = this._pickQuery(params, ['start', 'end']);
        return this._get({
            url: this.baseUrl + this.URLs.export,
            query,
        });
    }

    // ---- Behavioral Cohorts ------------------------------------------------

    /**
     * List cohorts for the project.
     * GET /api/3/cohorts
     */
    async listCohorts(params = {}) {
        const query = this._pickQuery(params, ['includeSyncInfo']);
        return this._get({
            url: this.baseUrl + this.URLs.cohorts,
            query,
        });
    }

    /**
     * Start an async cohort membership export.
     * GET /api/5/cohorts/request/{cohortId}
     */
    async requestCohortExport(cohortId, params = {}) {
        const query = this._pickQuery(params, ['props', 'propKeys']);
        return this._get({
            url: this.baseUrl + this.URLs.cohortExportRequest(cohortId),
            query,
        });
    }

    /**
     * Poll cohort export job status.
     * GET /api/5/cohorts/request-status/{requestId}
     */
    async getCohortExportStatus(requestId) {
        return this._get({
            url: this.baseUrl + this.URLs.cohortExportStatus(requestId),
        });
    }

    /**
     * Download a completed cohort export file.
     * GET /api/5/cohorts/request/{requestId}/file
     */
    async downloadCohort(requestId) {
        return this._get({
            url: this.baseUrl + this.URLs.cohortExportFile(requestId),
        });
    }

    // ---- User Profile (separate host) --------------------------------------

    /**
     * Get a user profile (properties, cohorts, computations, recommendations).
     * GET https://profile-api.amplitude.com/v1/userprofile
     * Requires user_id or device_id. Enterprise; not available in EU.
     */
    async getUserProfile(params = {}) {
        const query = this._pickQuery(params, [
            'user_id',
            'device_id',
            'get_amp_props',
            'get_cohort_ids',
            'get_computations',
            'comp_id',
            'get_recs',
            'rec_id',
            'rec_type',
            'get_propensity',
            'prediction_id',
            'propensity_type',
        ]);
        return this._get({
            url: this.profileBaseUrl + this.URLs.userProfile,
            query,
        });
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * Listing events returns 200 for valid project keys.
     */
    async testAuth() {
        return this.listEvents();
    }
}

module.exports = { Api, REGION_HOSTS, DEFAULT_PROFILE_BASE_URL };
