const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * PandaDoc Public API client.
 *
 * Auth: OAuth 2.0 (recommended) — Authorization: Bearer <access_token>
 *   Authorize: https://app.pandadoc.com/oauth2/authorize
 *   Token:     POST https://api.pandadoc.com/oauth2/access_token
 *   Scopes:    `read`, `write`, or space-separated `read write`
 *              (`read+write` is deprecated)
 *
 * Legacy API-Key auth (Authorization: API-Key <key>) is supported by the
 * public API for backwards compatibility but is not the path this module
 * uses for new connections.
 *
 * Base URL: https://api.pandadoc.com
 *
 * Official docs:  https://developers.pandadoc.com/
 * Official OpenAPI (v8.23.0):
 *   https://developers.pandadoc.com/openapi/pandadoc-public-api.json
 *   (GitHub mirror: https://github.com/PandaDoc/pandadoc-openapi-specification)
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.pandadoc.com';

        this.URLs = {
            // Identity / members
            members: '/public/v1/members',
            currentMember: '/public/v1/members/current',
            memberById: (id) => `/public/v1/members/${id}`,

            // Documents
            documents: '/public/v1/documents',
            documentById: (id) => `/public/v1/documents/${id}`,
            documentDetails: (id) => `/public/v1/documents/${id}/details`,
            documentStatus: (id) => `/public/v1/documents/${id}/status`,
            documentSend: (id) => `/public/v1/documents/${id}/send`,
            documentDraft: (id) => `/public/v1/documents/${id}/draft`,
            documentSession: (id) => `/public/v1/documents/${id}/session`,
            documentDownload: (id) => `/public/v1/documents/${id}/download`,
            documentEditingSessions: (id) =>
                `/public/v1/documents/${id}/editing-sessions`,

            // Templates
            templates: '/public/v1/templates',
            templateById: (id) => `/public/v1/templates/${id}`,
            templateDetails: (id) => `/public/v1/templates/${id}/details`,
            templateEditingSessions: (id) =>
                `/public/v1/templates/${id}/editing-sessions`,

            // Contacts
            contacts: '/public/v1/contacts',
            contactById: (id) => `/public/v1/contacts/${id}`,

            // Webhook subscriptions + delivery history
            webhookSubscriptions: '/public/v1/webhook-subscriptions',
            webhookSubscriptionById: (id) =>
                `/public/v1/webhook-subscriptions/${id}`,
            webhookSubscriptionSharedKey: (id) =>
                `/public/v1/webhook-subscriptions/${id}/shared-key`,
            webhookEvents: '/public/v1/webhook-events',
            webhookEventById: (id) => `/public/v1/webhook-events/${id}`,
        };

        const scope =
            this.scope ||
            get(params, 'scope', null) ||
            'read write';

        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: String(scope),
            state: this.state || '',
        });
        this.authorizationUri = `https://app.pandadoc.com/oauth2/authorize?${authParams.toString()}`;
        this.tokenUri = 'https://api.pandadoc.com/oauth2/access_token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Members / identity ------------------------------------------------

    /** GET /public/v1/members — list workspace members. */
    async listMembers(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.members +
                this._buildQuery(params),
        });
    }

    /** GET /public/v1/members/current — current authenticated member. */
    async detailsCurrentMember() {
        return this._get({
            url: this.baseUrl + this.URLs.currentMember,
        });
    }

    /** GET /public/v1/members/{id} — member by membership id. */
    async detailsMember(id) {
        return this._get({
            url: this.baseUrl + this.URLs.memberById(id),
        });
    }

    // ---- Documents ---------------------------------------------------------

    /** GET /public/v1/documents */
    async listDocuments(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.documents +
                this._buildQuery(params),
        });
    }

    /** POST /public/v1/documents — create from template or PDF URL. */
    async createDocument(data) {
        return this._post({
            url: this.baseUrl + this.URLs.documents,
            body: data,
        });
    }

    /** GET /public/v1/documents/{id} — document status. */
    async statusDocument(id) {
        return this._get({
            url: this.baseUrl + this.URLs.documentById(id),
        });
    }

    /** GET /public/v1/documents/{id}/details */
    async detailsDocument(id) {
        return this._get({
            url: this.baseUrl + this.URLs.documentDetails(id),
        });
    }

    /** PATCH /public/v1/documents/{id} */
    async updateDocument(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.documentById(id),
            body: data,
        });
    }

    /** DELETE /public/v1/documents/{id} */
    async deleteDocument(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.documentById(id),
        });
    }

    /** POST /public/v1/documents/{id}/send */
    async sendDocument(id, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.documentSend(id),
            body: data,
        });
    }

    /** PATCH /public/v1/documents/{id}/status */
    async changeDocumentStatus(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.documentStatus(id),
            body: data,
        });
    }

    /** POST /public/v1/documents/{id}/draft — revert to draft. */
    async documentRevertToDraft(id) {
        return this._post({
            url: this.baseUrl + this.URLs.documentDraft(id),
            body: {},
        });
    }

    /**
     * POST /public/v1/documents/{id}/session
     * Create an embedded signing session (returns session id).
     */
    async createDocumentLink(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.documentSession(id),
            body: data,
        });
    }

    /** GET /public/v1/documents/{id}/download */
    async downloadDocument(id, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.documentDownload(id) +
                this._buildQuery(params),
        });
    }

    /**
     * POST /public/v1/documents/{id}/editing-sessions
     * Create an Embedded Editor session (returns E-Token).
     */
    async createDocumentEditingSession(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.documentEditingSessions(id),
            body: data,
        });
    }

    // ---- Templates ---------------------------------------------------------

    /** GET /public/v1/templates */
    async listTemplates(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.templates +
                this._buildQuery(params),
        });
    }

    /** POST /public/v1/templates */
    async createTemplate(data) {
        return this._post({
            url: this.baseUrl + this.URLs.templates,
            body: data,
        });
    }

    /** GET /public/v1/templates/{id} */
    async statusTemplate(id) {
        return this._get({
            url: this.baseUrl + this.URLs.templateById(id),
        });
    }

    /** GET /public/v1/templates/{id}/details */
    async detailsTemplate(id) {
        return this._get({
            url: this.baseUrl + this.URLs.templateDetails(id),
        });
    }

    /** PATCH /public/v1/templates/{id} */
    async updateTemplate(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.templateById(id),
            body: data,
        });
    }

    /** DELETE /public/v1/templates/{id} */
    async deleteTemplate(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.templateById(id),
        });
    }

    /** POST /public/v1/templates/{id}/editing-sessions */
    async createTemplateEditingSession(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.templateEditingSessions(id),
            body: data,
        });
    }

    // ---- Contacts ----------------------------------------------------------

    /** GET /public/v1/contacts */
    async listContacts(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.contacts +
                this._buildQuery(params),
        });
    }

    /** POST /public/v1/contacts */
    async createContact(data) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            body: data,
        });
    }

    /** GET /public/v1/contacts/{id} */
    async detailsContact(id) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(id),
        });
    }

    /** PATCH /public/v1/contacts/{id} */
    async updateContact(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.contactById(id),
            body: data,
        });
    }

    /** DELETE /public/v1/contacts/{id} */
    async deleteContact(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactById(id),
        });
    }

    // ---- Webhook subscriptions ---------------------------------------------

    /** GET /public/v1/webhook-subscriptions */
    async listWebhookSubscriptions(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.webhookSubscriptions +
                this._buildQuery(params),
        });
    }

    /** POST /public/v1/webhook-subscriptions */
    async createWebhookSubscription(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            body: data,
        });
    }

    /** GET /public/v1/webhook-subscriptions/{id} */
    async detailsWebhookSubscription(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    /** PATCH /public/v1/webhook-subscriptions/{id} */
    async updateWebhookSubscription(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
            body: data,
        });
    }

    /** DELETE /public/v1/webhook-subscriptions/{id} */
    async deleteWebhookSubscription(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    /** PATCH /public/v1/webhook-subscriptions/{id}/shared-key — rotate key. */
    async updateWebhookSubscriptionSharedKey(id) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookSubscriptionSharedKey(id),
            body: {},
        });
    }

    /** GET /public/v1/webhook-events */
    async listWebhookEvent(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.webhookEvents +
                this._buildQuery(params),
        });
    }

    /** GET /public/v1/webhook-events/{id} */
    async detailsWebhookEvent(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookEventById(id),
        });
    }
}

module.exports = { Api };
