const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Jotform REST API client.
 *
 * Auth: API key sent in the `APIKEY` request header (official docs also
 * accept `apiKey` as a query parameter; this client uses the header).
 *   curl https://api.jotform.com/user -H "APIKEY: YOUR_API_KEY"
 *
 * Base URL (default US): https://api.jotform.com
 *   EU:    https://eu-api.jotform.com
 *   HIPAA: https://hipaa-api.jotform.com
 * Paths match the official Node SDK (`jotform` npm package), which uses
 * `/user`, `/form/{id}`, `/submission/{id}` under that host (no `/v1`
 * prefix on most resources).
 *
 * Docs: https://api.jotform.com/docs/
 * Official Node SDK: https://github.com/jotform/jotform-api-nodejs
 * Official Python SDK: https://github.com/jotform/jotform-api-python
 */
const DEFAULT_BASE_URL = 'https://api.jotform.com';

function normalizeBaseUrl(baseUrl) {
    if (!baseUrl) return null;
    return String(baseUrl).trim().replace(/\/+$/, '');
}

/**
 * Flatten a plain object into bracket-notation form fields for
 * application/x-www-form-urlencoded bodies (matches the official Node
 * SDK's postForm / Python client's nested submission[qid] encoding).
 */
function flattenFormFields(value, prefix = '', out = {}) {
    if (value === undefined || value === null) return out;
    if (
        typeof value !== 'object' ||
        Array.isArray(value) ||
        value instanceof Date
    ) {
        if (prefix) out[prefix] = value;
        return out;
    }
    for (const [key, child] of Object.entries(value)) {
        const next = prefix ? `${prefix}[${key}]` : key;
        flattenFormFields(child, next, out);
    }
    return out;
}

function toFormBody(fields) {
    const flat = flattenFormFields(fields);
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(flat)) {
        if (value === undefined || value === null) continue;
        usp.append(key, String(value));
    }
    return usp.toString();
}

/**
 * Build list/filter query params. Jotform's `filter` must be a JSON string
 * when provided as an object (official Python/Node clients both do this).
 */
function normalizeListQuery(params = {}) {
    const query = {};
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (key === 'filter' && typeof value === 'object') {
            query.filter = JSON.stringify(value);
        } else {
            query[key] = value;
        }
    }
    return query;
}

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'APIKEY';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);

        this.baseUrl =
            normalizeBaseUrl(
                get(params, 'base_url', null) ||
                    get(params, 'baseUrl', null) ||
                    get(params, 'api_url', null) ||
                    get(params, 'apiUrl', null)
            ) || DEFAULT_BASE_URL;

        this.URLs = {
            user: '/user',
            userForms: '/user/forms',
            userSubmissions: '/user/submissions',
            form: '/form',
            formById: (formId) => `/form/${formId}`,
            formQuestions: (formId) => `/form/${formId}/questions`,
            formProperties: (formId) => `/form/${formId}/properties`,
            formSubmissions: (formId) => `/form/${formId}/submissions`,
            formWebhooks: (formId) => `/form/${formId}/webhooks`,
            formWebhookById: (formId, webhookId) =>
                `/form/${formId}/webhooks/${webhookId}`,
            submissionById: (submissionId) => `/submission/${submissionId}`,
        };
    }

    /**
     * Point the client at a regional/Enterprise API host.
     * @param {string} baseUrl e.g. https://eu-api.jotform.com
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = normalizeBaseUrl(baseUrl) || DEFAULT_BASE_URL;
    }

    /**
     * POST application/x-www-form-urlencoded (Jotform write endpoints).
     * Passes stringify=false so the core Requester sends the raw body.
     */
    async _postForm(url, fields) {
        return this._post(
            {
                url,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: toFormBody(fields),
            },
            false
        );
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get user account details for this API key.
     * GET /user
     * https://api.jotform.com/docs/#user
     *
     * Response envelope: { responseCode, message, content: { username, name,
     * email, website, account_type, status, created_at, … } }
     */
    async getUser() {
        return this._get({
            url: this.baseUrl + this.URLs.user,
        });
    }

    // ---- Forms -------------------------------------------------------------

    /**
     * List forms for this account.
     * GET /user/forms
     * https://api.jotform.com/docs/#user-forms
     *
     * Optional params: offset, limit, filter (object|JSON string), orderby,
     * direction.
     */
    async listForms(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userForms,
            query: normalizeListQuery(params),
        });
    }

    /**
     * Get basic information about a form.
     * GET /form/{formID}
     * https://api.jotform.com/docs/#form-id
     */
    async getForm(formId) {
        return this._get({
            url: this.baseUrl + this.URLs.formById(formId),
        });
    }

    /**
     * Create a new form.
     * POST /form (application/x-www-form-urlencoded)
     * https://api.jotform.com/docs/#post-forms
     * Official Node SDK: client.form.createForm(parameters)
     *
     * Body fields follow Jotform's nested form encoding, e.g.
     *   { questions: { 1: { type, text, order, name } }, properties: { title } }
     * which flattens to questions[1][type]=… etc.
     */
    async createForm(fields = {}) {
        return this._postForm(this.baseUrl + this.URLs.form, fields);
    }

    /**
     * Delete a form.
     * DELETE /form/{formID}
     * https://api.jotform.com/docs/#delete-form-id
     */
    async deleteForm(formId) {
        return this._delete({
            url: this.baseUrl + this.URLs.formById(formId),
        });
    }

    /**
     * Add or edit properties of a form (title, styles, etc.).
     * POST /form/{formID}/properties (application/x-www-form-urlencoded)
     * https://api.jotform.com/docs/#post-form-id-properties
     *
     * Pass either `{ properties: { title: '…' } }` or a flat properties map
     * which will be wrapped as `{ properties: … }`.
     */
    async updateFormProperties(formId, properties = {}) {
        const fields =
            properties &&
            typeof properties === 'object' &&
            properties.properties
                ? properties
                : { properties };
        return this._postForm(
            this.baseUrl + this.URLs.formProperties(formId),
            fields
        );
    }

    /**
     * List all questions on a form.
     * GET /form/{formID}/questions
     * https://api.jotform.com/docs/#form-id-questions
     */
    async listFormQuestions(formId) {
        return this._get({
            url: this.baseUrl + this.URLs.formQuestions(formId),
        });
    }

    // ---- Submissions -------------------------------------------------------

    /**
     * List submissions for a form.
     * GET /form/{formID}/submissions
     * https://api.jotform.com/docs/#form-id-submissions
     *
     * Optional params: offset, limit, filter, orderby, direction.
     */
    async listFormSubmissions(formId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.formSubmissions(formId),
            query: normalizeListQuery(params),
        });
    }

    /**
     * List submissions across all forms on this account.
     * GET /user/submissions
     * https://api.jotform.com/docs/#user-submissions
     */
    async listUserSubmissions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userSubmissions,
            query: normalizeListQuery(params),
        });
    }

    /**
     * Get a single submission.
     * GET /submission/{submissionID}
     * https://api.jotform.com/docs/#submission-id
     */
    async getSubmission(submissionId) {
        return this._get({
            url: this.baseUrl + this.URLs.submissionById(submissionId),
        });
    }

    /**
     * Create a submission on a form.
     * POST /form/{formID}/submissions (application/x-www-form-urlencoded)
     * https://api.jotform.com/docs/#post-form-id-submissions
     * Official Node SDK: client.form.addSubmission(formId, submissionData)
     *
     * `submission` is a map of question id → answer, e.g. { '1': 'a@b.com' }.
     * Encoded as submission[1]=…
     */
    async createFormSubmission(formId, submission = {}) {
        return this._postForm(
            this.baseUrl + this.URLs.formSubmissions(formId),
            { submission }
        );
    }

    /**
     * Edit a single submission.
     * POST /submission/{submissionID} (application/x-www-form-urlencoded)
     * https://api.jotform.com/docs/#post-submission-id
     */
    async updateSubmission(submissionId, submission = {}) {
        return this._postForm(
            this.baseUrl + this.URLs.submissionById(submissionId),
            { submission }
        );
    }

    /**
     * Delete a single submission.
     * DELETE /submission/{submissionID}
     * https://api.jotform.com/docs/#delete-submission-id
     */
    async deleteSubmission(submissionId) {
        return this._delete({
            url: this.baseUrl + this.URLs.submissionById(submissionId),
        });
    }

    // ---- Webhooks (per-form subscription management) -----------------------

    /**
     * List webhooks for a form.
     * GET /form/{formID}/webhooks
     * https://api.jotform.com/docs/#form-id-webhooks
     */
    async listFormWebhooks(formId) {
        return this._get({
            url: this.baseUrl + this.URLs.formWebhooks(formId),
        });
    }

    /**
     * Register a webhook URL for form submissions.
     * POST /form/{formID}/webhooks (application/x-www-form-urlencoded)
     * https://api.jotform.com/docs/#post-form-id-webhooks
     *
     * Official example:
     *   curl -X POST -d "webhookURL=…" "https://api.jotform.com/v1/form/{id}/webhooks"
     */
    async createFormWebhook(formId, webhookURL) {
        return this._postForm(
            this.baseUrl + this.URLs.formWebhooks(formId),
            { webhookURL }
        );
    }

    /**
     * Delete a webhook of a form.
     * DELETE /form/{formID}/webhooks/{webhookID}
     * https://api.jotform.com/docs/#delete-form-id-webhooks-id
     */
    async deleteFormWebhook(formId, webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.formWebhookById(formId, webhookId),
        });
    }
}

module.exports = {
    Api,
    DEFAULT_BASE_URL,
    flattenFormFields,
    toFormBody,
    normalizeListQuery,
};
