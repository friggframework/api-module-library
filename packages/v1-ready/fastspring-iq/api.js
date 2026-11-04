const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * FastSpring IQ API client.
 *
 * FastSpring IQ is the interactive-quotes product (formerly SalesRight). Its
 * public REST API is documented in the official Postman collection
 * "FastSpring IQ API (v1.8.12)":
 *   https://documenter.getpostman.com/view/5578104/T1DjkKg1
 *
 * Auth: every request sends an `api_key` header. The key is issued by your
 * FastSpring account manager; rotate via POST /auth/rotatekey.
 *
 * Base URL: https://api-iq.fastspring.com
 *
 * This is distinct from the FastSpring commerce API at https://api.fastspring.com
 * (HTTP Basic). Do not mix the two.
 *
 * The canonical machine-readable contract lives in ./fastspring-iq.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'api_key';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);

        this.baseUrl = 'https://api-iq.fastspring.com';

        this.URLs = {
            myOrganization: '/my-organization',
            rotateApiKey: '/auth/rotatekey',
            quotes: '/quotes',
            quotesSearch: '/quotes/search',
            quoteById: (id) => `/quotes/${id}`,
            quoteBreakdown: (id) => `/quotes/${id}/breakdown`,
            quoteCopy: (id) => `/quotes/copy/${id}`,
            quoteClosedWon: (id) => `/quotes/${id}/closed-won`,
            quoteClosedLost: (id) => `/quotes/${id}/closed-lost`,
            quotePublish: (id) => `/quotes/${id}/publish`,
            quoteUnpublish: (id) => `/quotes/${id}/unpublish`,
            publishedQuotes: '/published-quotes',
            publishedQuoteById: (id) => `/published-quotes/${id}`,
            publishedQuoteAnalytics: (id) =>
                `/published-quotes/${id}/analytics`,
            publishedQuoteBreakdown: (id) =>
                `/published-quotes/${id}/breakdown`,
            templates: '/templates',
            templatesSearch: '/templates/search',
            templateById: (id) => `/templates/${id}`,
            companies: '/companies',
            companyById: (id) => `/companies/${id}`,
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            activities: '/activities',
            activityById: (id) => `/activities/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };

        // Documented webhook topics (Create Webhook): all, quotes.*, published-quotes.*, activities.*
        this.webhookTopics = {
            all: '*/*',
            quotesAll: 'quotes/*',
            quotesCreate: 'quotes/create',
            quotesUpdate: 'quotes/update',
            quotesDelete: 'quotes/delete',
            publishedQuotesAll: 'published-quotes/*',
            publishedQuotesCreate: 'published-quotes/create',
            publishedQuotesUpdate: 'published-quotes/update',
            publishedQuotesDelete: 'published-quotes/delete',
            activitiesAll: 'activities/*',
            activitiesCreate: 'activities/create',
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'FastSpring IQ Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'FastSpring IQ API key (header name `api_key`). Obtain from your FastSpring account manager; rotate via POST /auth/rotatekey.',
                        'ui:placeholder': 'Your FastSpring IQ API key',
                    },
                },
            },
        };
    }

    // ---- Auth / identity ----------------------------------------------------

    /**
     * Get the organization for the current api_key.
     * GET /my-organization
     * Response: { id, name, city, country, address, ... }
     */
    async getMyOrganization() {
        return this._get({ url: this.baseUrl + this.URLs.myOrganization });
    }

    /**
     * Rotate the organization API key.
     * POST /auth/rotatekey
     * Collection intro: use this to rotate the api_key. (Some Postman request
     * descriptions mention Bearer JWT — treat that as an open question.)
     */
    async rotateApiKey(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.rotateApiKey,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Quotes -------------------------------------------------------------

    /**
     * List quotes.
     * GET /quotes/
     * Optional query: includes (e.g. "summary,tags,analytics,company")
     */
    async listQuotes(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.quotes + '/',
            query,
        });
    }

    /**
     * Search quotes.
     * GET /quotes/search
     * Query: query (title/description), contactEmail?, companyId?
     */
    async searchQuotes(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.quotesSearch,
            query,
        });
    }

    /** GET /quotes/{quoteId} */
    async getQuote(quoteId) {
        return this._get({
            url: this.baseUrl + this.URLs.quoteById(quoteId),
        });
    }

    /**
     * GET /quotes/{quoteId}/breakdown
     * Pass `{ asHtml: true }` to request text/html (documented Content-Type).
     */
    async getQuoteBreakdown(quoteId, { asHtml = false } = {}) {
        const headers = asHtml
            ? { 'Content-Type': 'text/html' }
            : { 'Content-Type': 'application/json' };
        return this._get({
            url: this.baseUrl + this.URLs.quoteBreakdown(quoteId),
            headers,
        });
    }

    /** POST /quotes/ — body is the full quote payload (or { templateId }). */
    async createQuote(data) {
        return this._post({
            url: this.baseUrl + this.URLs.quotes + '/',
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PATCH /quotes/{quoteId} */
    async updateQuote(quoteId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.quoteById(quoteId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** POST /quotes/copy/{sourceQuoteId} */
    async copyQuote(sourceQuoteId, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.quoteCopy(sourceQuoteId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** POST /quotes/{quoteId}/closed-won */
    async setQuoteClosedWon(quoteId, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.quoteClosedWon(quoteId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** POST /quotes/{quoteId}/closed-lost */
    async setQuoteClosedLost(quoteId, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.quoteClosedLost(quoteId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** POST /quotes/{quoteId}/publish */
    async publishQuote(quoteId, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.quotePublish(quoteId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** POST /quotes/{quoteId}/unpublish */
    async unpublishQuote(quoteId, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.quoteUnpublish(quoteId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Published quotes ---------------------------------------------------

    /** GET /published-quotes/ */
    async listPublishedQuotes(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.publishedQuotes + '/',
            query,
        });
    }

    /** GET /published-quotes/{quoteId} */
    async getPublishedQuote(quoteId) {
        return this._get({
            url: this.baseUrl + this.URLs.publishedQuoteById(quoteId),
        });
    }

    /** GET /published-quotes/{publishedQuoteId}/analytics */
    async getPublishedQuoteAnalytics(publishedQuoteId) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.publishedQuoteAnalytics(publishedQuoteId),
        });
    }

    /**
     * GET /published-quotes/{quoteId}/breakdown
     * Pass `{ asHtml: true }` for text/html.
     */
    async getPublishedQuoteBreakdown(quoteId, { asHtml = false } = {}) {
        const headers = asHtml
            ? { 'Content-Type': 'text/html' }
            : { 'Content-Type': 'application/json' };
        return this._get({
            url: this.baseUrl + this.URLs.publishedQuoteBreakdown(quoteId),
            headers,
        });
    }

    // ---- Quote templates ----------------------------------------------------

    /** GET /templates */
    async listTemplates(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.templates,
            query,
        });
    }

    /** GET /templates/search */
    async searchTemplates(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.templatesSearch,
            query,
        });
    }

    /** GET /templates/{templateId} */
    async getTemplate(templateId) {
        return this._get({
            url: this.baseUrl + this.URLs.templateById(templateId),
        });
    }

    /** POST /templates/ */
    async createTemplate(data) {
        return this._post({
            url: this.baseUrl + this.URLs.templates + '/',
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PATCH /templates/{templateId} */
    async updateTemplate(templateId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.templateById(templateId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Companies ----------------------------------------------------------

    /** GET /companies/ */
    async listCompanies(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companies + '/',
            query,
        });
    }

    /** GET /companies/{companyId} */
    async getCompany(companyId) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(companyId),
        });
    }

    /**
     * POST /companies/
     * Body fields (documented): name, website?, address?, sourceType?, sourceId?
     */
    async createCompany(data) {
        return this._post({
            url: this.baseUrl + this.URLs.companies + '/',
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /companies/{companyId} */
    async updateCompany(companyId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.companyById(companyId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Contacts -----------------------------------------------------------

    /**
     * GET /contacts/
     * Optional filter: companyId (documented example response is filtered).
     */
    async listContacts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.contacts + '/',
            query,
        });
    }

    /** GET /contacts/{contactId} */
    async getContact(contactId) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(contactId),
        });
    }

    /**
     * POST /contacts/
     * Body: companyId, email, firstName, lastName, phone?, sourceType?, sourceId?
     */
    async createContact(data) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts + '/',
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /contacts/{contactId} */
    async updateContact(contactId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.contactById(contactId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /contacts/{contactId} */
    async deleteContact(contactId) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactById(contactId),
        });
    }

    // ---- Activities ---------------------------------------------------------

    /** GET /activities/ */
    async listActivities(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.activities + '/',
            query,
        });
    }

    /** GET /activities/{activityId} */
    async getActivity(activityId) {
        return this._get({
            url: this.baseUrl + this.URLs.activityById(activityId),
        });
    }

    /**
     * POST /activities/
     * Example body: type, quoteId, message, sourceType?, sourceUserId?, sourceUsername?
     */
    async createActivity(data) {
        return this._post({
            url: this.baseUrl + this.URLs.activities + '/',
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Webhooks -----------------------------------------------------------

    /** GET /webhooks */
    async listWebhooks(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query,
        });
    }

    /** GET /webhooks/{webhookId} */
    async getWebhook(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * POST /webhooks
     * Required: url, topic. Optional: method (default POST), headers, filters,
     * organizationId.
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /webhooks/{webhookId} */
    async updateWebhook(webhookId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /webhooks/{webhookId} — 204 on success */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }
}

module.exports = { Api };
