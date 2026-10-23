const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Typeform public API client (OAuth 2.0).
 *
 * Auth: Bearer access token from Typeform's authorization-code OAuth flow
 * (or a personal access token). Token exchange is application/x-www-form-urlencoded
 * at https://api.typeform.com/oauth/token. Include the `offline` scope to receive
 * a refresh token; refresh rotates the refresh token.
 *
 * Base URL: https://api.typeform.com
 * EU data center (when configured on the account): https://api.eu.typeform.com
 * Rate limit: 2 requests/second per account (Create + Responses APIs).
 *
 * Official sources:
 *   https://www.typeform.com/developers/get-started/
 *   https://www.typeform.com/developers/get-started/applications/
 *   https://www.typeform.com/developers/get-started/scopes/
 *   https://www.typeform.com/developers/create/
 *   https://www.typeform.com/developers/responses/
 *   https://www.typeform.com/developers/webhooks/
 *
 * The curated machine-readable contract lives in ./typeform.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.TYPEFORM_BASE_URL ||
            'https://api.typeform.com';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        const scope =
            this.scope ||
            process.env.TYPEFORM_SCOPE ||
            [
                'offline',
                'accounts:read',
                'forms:read',
                'forms:write',
                'responses:read',
                'webhooks:read',
                'webhooks:write',
            ].join(' ');

        const authParams = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope,
        });
        if (this.state) authParams.set('state', this.state);

        // Authorize + token live on the API host (not a separate auth domain).
        this.authorizationUri = `${this.baseUrl}/oauth/authorize?${authParams.toString()}`;
        this.tokenUri = `${this.baseUrl}/oauth/token`;

        this.URLs = {
            me: '/me',
            forms: '/forms',
            formById: (formId) => `/forms/${formId}`,
            responses: (formId) => `/forms/${formId}/responses`,
            webhooks: (formId) => `/forms/${formId}/webhooks`,
            webhookByTag: (formId, tag) => `/forms/${formId}/webhooks/${tag}`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Retrieve the authenticated account profile.
     * GET /me
     * Scope: accounts:read
     *
     * Response (official hands-on docs):
     *   { alias, email, language }
     *
     * Docs: https://www.typeform.com/developers/get-started/hands-on/
     */
    async getMe() {
        return this._get({
            url: this.baseUrl + this.URLs.me,
        });
    }

    /** Alias used by Definition identity helpers. */
    async getUserDetails() {
        return this.getMe();
    }

    // ---- Forms (Create API) ------------------------------------------------

    /**
     * List forms in the account.
     * GET /forms
     * Scope: forms:read
     *
     * Query (all optional): search, page, page_size (max 200), workspace_id,
     *   sort_by (created_at|last_updated_at), order_by (asc|desc), is_public
     *
     * Docs: https://www.typeform.com/developers/create/reference/retrieve-forms/
     */
    async listForms(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.forms,
            query: params,
        });
    }

    /**
     * Retrieve a single form by id.
     * GET /forms/{form_id}
     * Scope: forms:read
     *
     * Docs: https://www.typeform.com/developers/create/reference/retrieve-form/
     */
    async getForm(formId) {
        return this._get({
            url: this.baseUrl + this.URLs.formById(formId),
        });
    }

    /**
     * Create a form.
     * POST /forms
     * Scope: forms:write
     *
     * Body: title (required), type, settings, theme, workspace, fields, …
     * Docs: https://www.typeform.com/developers/create/reference/create-form/
     */
    async createForm(data) {
        return this._post({
            url: this.baseUrl + this.URLs.forms,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Full-replace update of a form (PUT overwrites the stored form).
     * PUT /forms/{form_id}
     * Scope: forms:write
     *
     * Docs: https://www.typeform.com/developers/create/reference/update-form/
     */
    async updateForm(formId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.formById(formId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a form and its responses.
     * DELETE /forms/{form_id}
     * Scope: forms:write
     *
     * Docs: https://www.typeform.com/developers/create/reference/delete-form/
     */
    async deleteForm(formId) {
        return this._delete({
            url: this.baseUrl + this.URLs.formById(formId),
        });
    }

    // ---- Responses ---------------------------------------------------------

    /**
     * Retrieve responses for a form.
     * GET /forms/{form_id}/responses
     * Scope: responses:read
     *
     * Query (all optional): page_size, since, until, after, before,
     *   included_response_ids, excluded_response_ids, response_type, completed,
     *   sort, query, fields
     *
     * Docs: https://www.typeform.com/developers/responses/reference/retrieve-responses/
     */
    async listResponses(formId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.responses(formId),
            query: params,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks for a form.
     * GET /forms/{form_id}/webhooks
     * Scope: webhooks:read
     *
     * Docs: https://www.typeform.com/developers/webhooks/reference/retrieve-webhooks/
     */
    async listWebhooks(formId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks(formId),
        });
    }

    /**
     * Retrieve a single webhook by tag.
     * GET /forms/{form_id}/webhooks/{tag}
     * Scope: webhooks:read
     *
     * Docs: https://www.typeform.com/developers/get-started/scopes/
     */
    async getWebhook(formId, tag) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookByTag(formId, tag),
        });
    }

    /**
     * Create or update a webhook (upsert by tag).
     * PUT /forms/{form_id}/webhooks/{tag}
     * Scope: webhooks:write
     *
     * Body: url, enabled?, event_types?, secret?, verify_ssl? (verify_ssl is
     * read-only / ignored on write — derived from the URL scheme).
     *
     * Docs: https://www.typeform.com/developers/webhooks/reference/create-or-update-webhook/
     */
    async createOrUpdateWebhook(formId, tag, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookByTag(formId, tag),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /forms/{form_id}/webhooks/{tag}
     * Scope: webhooks:write
     *
     * Docs: https://www.typeform.com/developers/webhooks/reference/delete-webhook/
     */
    async deleteWebhook(formId, tag) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookByTag(formId, tag),
        });
    }
}

module.exports = { Api };
