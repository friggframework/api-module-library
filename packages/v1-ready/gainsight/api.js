const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Default OpenAPI / client base URL (tenant placeholder).
 * Real installs must set `base_url` to the Gainsight customer domain
 * (e.g. https://acme.gainsightcloud.com). Official docs use
 * companyapi.gainsightcloud.com / personapi.gainsightcloud.com / <customer domain>
 * as examples — Pipedream and tenant callouts use `{customer_domain}` for all
 * paths under /v1 and /v2.
 *
 * Sources:
 * - https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs
 * - https://support.gainsight.com/gainsight_nxt/API_and_Developer_Docs/Generate_REST_API/Generate_REST_API_Key
 */
const DEFAULT_BASE_URL = 'https://example.gainsightcloud.com';

/**
 * Gainsight CS (NXT) REST API client.
 *
 * Auth: static Access Key in the `accesskey` request header (does not expire).
 * Admin generation: Administration > Connectors 2.0 > Gainsight API (Access_Key).
 * There is no official Gainsight CS OpenAPI; this module's curated
 * gainsight.openapi.yaml is derived from support.gainsight.com articles.
 *
 * Note: Gainsight Events API publishes events *into* Gainsight (inbound). There
 * is no documented outbound webhook subscription management API for CS NXT, so
 * this client does not implement webhook CRUD.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // Docs: pass Access Key as request header "accesskey".
        this.api_key_name = 'accesskey';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        const rawBase =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            process.env.GAINSIGHT_BASE_URL ||
            DEFAULT_BASE_URL;
        this.baseUrl = String(rawBase).replace(/\/+$/, '');

        this.URLs = {
            // Company object (MDA)
            company: '/v1/data/objects/Company',
            companyQuery: '/v1/data/objects/query/Company',
            companyByGsid: (gsid) => `/v1/data/objects/Company/${gsid}`,
            // Custom / scorecard objects
            customObject: (objectName) => `/v1/data/objects/${objectName}`,
            customObjectQuery: (objectName) =>
                `/v1/data/objects/query/${objectName}`,
            customObjectByGsid: (objectName, gsid) =>
                `/v1/data/objects/${objectName}/${gsid}`,
            // People
            people: '/v1/peoplemgmt/v1.0/people',
            peopleByGsid: (gsid) => `/v1/peoplemgmt/v1.0/people/${gsid}`,
            // Users
            users: '/v1/users/services',
            usersList: '/v1/users/services/list',
            // Metadata (custom fields / object discovery)
            objectsList: '/v1/meta/services/objects/list',
            objectDescribe: (objectName) =>
                `/v1/meta/services/objects/${objectName}/describe`,
            // Cockpit CTAs / tasks
            cta: '/v2/cockpit/cta/',
            ctaList: '/v2/cockpit/cta/list',
            task: '/v2/cockpit/task',
            taskList: (ctaGsid) => `/v2/cockpit/task/list/${ctaGsid}`,
            // Timeline
            timelineBulk: '/v1/ant/es/activity/bulk',
            timelineJobStatus: (jobId) => `/v1/ant/es/job/status/${jobId}`,
            timelineQuery: '/v1/data/objects/query/activity_timeline',
        };
    }

    setBaseUrl(baseUrl) {
        if (baseUrl) {
            this.baseUrl = String(baseUrl).replace(/\/+$/, '');
        }
    }

    _jsonHeaders(extra = {}) {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            ...extra,
        };
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Company ------------------------------------------------------------

    /**
     * Read Company records matching a query body.
     * POST /v1/data/objects/query/Company
     * Max 5000 records per call; use offset for further pages.
     */
    async queryCompanies(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.companyQuery,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Insert Company records (max 50 per call).
     * POST /v1/data/objects/Company
     */
    async createCompanies(body) {
        return this._post({
            url: this.baseUrl + this.URLs.company,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Update Company records identified by `keys` query param.
     * PUT /v1/data/objects/Company?keys=fieldName1,fieldName2
     */
    async updateCompanies(body, keys) {
        const keyParam = Array.isArray(keys) ? keys.join(',') : keys;
        return this._put({
            url:
                this.baseUrl +
                this.URLs.company +
                this._buildQuery({ keys: keyParam }),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Delete a Company by GSID.
     * DELETE /v1/data/objects/Company/{GSID}
     */
    async deleteCompany(gsid) {
        return this._delete({
            url: this.baseUrl + this.URLs.companyByGsid(gsid),
            headers: this._jsonHeaders(),
        });
    }

    // ---- People / contacts --------------------------------------------------

    /**
     * Get one Person (plus Company Person / Relationship Person) by email.
     * GET /v1/peoplemgmt/v1.0/people?Email=...
     */
    async getPersonByEmail(email) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.people +
                this._buildQuery({ Email: email }),
            headers: this._jsonHeaders(),
        });
    }

    /**
     * Get one Person by GSID.
     * Official docs show path suffix `/people/gsid` as a placeholder wording;
     * community and REST convention use `/people/{gsid}`. See open questions.
     * GET /v1/peoplemgmt/v1.0/people/{gsid}
     */
    async getPersonByGsid(gsid) {
        return this._get({
            url: this.baseUrl + this.URLs.peopleByGsid(gsid),
            headers: this._jsonHeaders(),
        });
    }

    /**
     * Upsert Person / Company Person / Relationship Person records.
     * PUT /v1/peoplemgmt/v1.0/people
     */
    async upsertPeople(body) {
        return this._put({
            url: this.baseUrl + this.URLs.people,
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Users --------------------------------------------------------------

    /**
     * Fetch user details (GsUser).
     * POST /v1/users/services/list
     */
    async listUsers(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.usersList,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Create users (max 50).
     * POST /v1/users/services?notify=true|false
     */
    async createUsers(body, params = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.users + this._buildQuery(params),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Update users identified by `key` query field.
     * PUT /v1/users/services?key=FieldName
     */
    async updateUsers(body, key) {
        return this._put({
            url: this.baseUrl + this.URLs.users + this._buildQuery({ key }),
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Metadata / custom fields -------------------------------------------

    /**
     * List metadata objects (standard + custom; used to discover scorecard objs).
     * GET /v1/meta/services/objects/list
     */
    async listObjects(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.objectsList + this._buildQuery(params),
            headers: this._jsonHeaders(),
        });
    }

    /**
     * Describe an object's fields (custom field discovery).
     * GET /v1/meta/services/objects/{objectName}/describe
     */
    async describeObject(objectName, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.objectDescribe(objectName) +
                this._buildQuery(params),
            headers: this._jsonHeaders(),
        });
    }

    // ---- Custom objects / health scores -------------------------------------

    /**
     * Query a custom (or scorecard) object.
     * POST /v1/data/objects/query/{objectName}
     *
     * Official Scorecard FAQ: there is no direct Scorecard write API; read
     * Scorecard data via the Custom Object API with the tenant's scorecard
     * object name (discover via listObjects / describeObject).
     */
    async queryCustomObject(objectName, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.customObjectQuery(objectName),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Insert records into a custom object (max 50).
     * POST /v1/data/objects/{objectName}
     */
    async createCustomObjectRecords(objectName, body) {
        return this._post({
            url: this.baseUrl + this.URLs.customObject(objectName),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Update custom object records by keys.
     * PUT /v1/data/objects/{objectName}?keys=...
     */
    async updateCustomObjectRecords(objectName, body, keys) {
        const keyParam = Array.isArray(keys) ? keys.join(',') : keys;
        return this._put({
            url:
                this.baseUrl +
                this.URLs.customObject(objectName) +
                this._buildQuery({ keys: keyParam }),
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Delete a custom object record by GSID.
     * DELETE /v1/data/objects/{objectName}/{GSID}
     */
    async deleteCustomObjectRecord(objectName, gsid) {
        return this._delete({
            url: this.baseUrl + this.URLs.customObjectByGsid(objectName, gsid),
            headers: this._jsonHeaders(),
        });
    }

    // ---- Cockpit CTAs -------------------------------------------------------

    /**
     * Fetch CTAs (max 1000 per page; use pn/ps in body).
     * POST /v2/cockpit/cta/list
     */
    async listCtas(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.ctaList,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Create a CTA.
     * POST /v2/cockpit/cta/
     */
    async createCta(body) {
        return this._post({
            url: this.baseUrl + this.URLs.cta,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Update a CTA.
     * PUT /v2/cockpit/cta/
     */
    async updateCta(body) {
        return this._put({
            url: this.baseUrl + this.URLs.cta,
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Cockpit tasks ------------------------------------------------------

    /**
     * List tasks for a CTA.
     * GET /v2/cockpit/task/list/{CTA_GSID}
     */
    async listTasks(ctaGsid, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.taskList(ctaGsid) +
                this._buildQuery(params),
            headers: this._jsonHeaders(),
        });
    }

    /**
     * Create a task on an existing CTA.
     * POST /v2/cockpit/task
     */
    async createTask(body) {
        return this._post({
            url: this.baseUrl + this.URLs.task,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Update an existing task.
     * PUT /v2/cockpit/task
     */
    async updateTask(body) {
        return this._put({
            url: this.baseUrl + this.URLs.task,
            headers: this._jsonHeaders(),
            body,
        });
    }

    // ---- Timeline / activities ----------------------------------------------

    /**
     * Read timeline activities via MDA query on activity_timeline.
     * POST /v1/data/objects/query/activity_timeline
     */
    async queryTimelineActivities(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.timelineQuery,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Bulk insert timeline activities.
     * POST /v1/ant/es/activity/bulk
     */
    async createTimelineActivities(body) {
        return this._post({
            url: this.baseUrl + this.URLs.timelineBulk,
            headers: this._jsonHeaders(),
            body,
        });
    }

    /**
     * Poll bulk timeline job status.
     * GET /v1/ant/es/job/status/{jobId}
     */
    async getTimelineJobStatus(jobId) {
        return this._get({
            url: this.baseUrl + this.URLs.timelineJobStatus(jobId),
            headers: this._jsonHeaders(),
        });
    }
}

module.exports = { Api, DEFAULT_BASE_URL };
