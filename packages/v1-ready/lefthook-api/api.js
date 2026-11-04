const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Left Hook Core API client.
 *
 * Auth: API key sent as `Authorization: Bearer <key>`.
 * Base URL: https://api.lefthook.com
 *
 * This surface is Left Hook's own Core API (companies, deals, invoices,
 * milestones, bank accounts, metrics/snapshots, sync status, and domain-model
 * change requests). There is no public OpenAPI or developer hub for
 * api.lefthook.com at authoring time; endpoints here are ported from
 * Left Hook-owned module code cleared for the api-module-library, and are
 * labeled for verification against an internal API reference when available.
 *
 * Env: LEFTHOOK_API_KEY
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        const apiKey =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        // Persist the bare key; addAuthHeaders prefixes "Bearer ".
        this.api_key_name = 'Authorization';
        if (apiKey) {
            this.setApiKey(String(apiKey).replace(/^Bearer\s+/i, '').trim());
        }

        this.baseUrl = 'https://api.lefthook.com';

        this.URLs = {
            authVerify: '/v1/auth/verify',
            companies: '/v1/companies',
            companyById: (id) => `/v1/companies/${id}`,
            invoices: '/v1/invoices',
            invoiceById: (id) => `/v1/invoices/${id}`,
            invoiceSyncXero: '/v1/invoices/sync/xero',
            deals: '/v1/deals',
            dealById: (id) => `/v1/deals/${id}`,
            dealSyncHubSpot: '/v1/deals/sync/hubspot',
            milestones: '/v1/milestones',
            milestoneById: (id) => `/v1/milestones/${id}`,
            milestoneSyncClickUp: '/v1/milestones/sync/clickup',
            bankAccounts: '/v1/bank-accounts',
            bankAccountById: (id) => `/v1/bank-accounts/${id}`,
            bankAccountSyncMercury: '/v1/bank-accounts/sync/mercury',
            bankBalances: '/v1/bank-balances',
            metrics: '/v1/metrics',
            metricsDelivery: '/v1/metrics/delivery',
            metricsGtm: '/v1/metrics/gtm',
            metricsFinance: '/v1/metrics/finance',
            snapshotDelivery: '/v1/snapshots/delivery',
            snapshotGtm: '/v1/snapshots/gtm',
            snapshotFinance: '/v1/snapshots/finance',
            syncStatus: '/v1/sync-status',
            syncStatusById: (id) => `/v1/sync-status/${id}`,
            changeRequests: '/v1/domain-model/change-requests',
            changeRequestById: (id) => `/v1/domain-model/change-requests/${id}`,
            changeRequestSubmit: (id) =>
                `/v1/domain-model/change-requests/${id}/submit`,
            changeRequestApprove: (id) =>
                `/v1/domain-model/change-requests/${id}/approve`,
            changeRequestReject: (id) =>
                `/v1/domain-model/change-requests/${id}/reject`,
            changeRequestWithdraw: (id) =>
                `/v1/domain-model/change-requests/${id}/withdraw`,
            changeRequestMerged: (id) =>
                `/v1/domain-model/change-requests/${id}/merged`,
            changeRequestWebhook: '/v1/domain-model/change-requests/webhook',
            domainModel: '/v1/domain-model',
            domainModelHistory: '/v1/domain-model/history',
        };
    }

    /**
     * Emit `Authorization: Bearer <key>`. The stored credential is the bare
     * key; the "Bearer " prefix is added here so it never lives in the DB.
     */
    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.api_key) {
            h[this.api_key_name] = `Bearer ${this.api_key}`;
        }
        return h;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Left Hook API Authentication',
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
                            'Left Hook Core API key. Sent as Authorization: Bearer <key>.',
                        'ui:placeholder': 'Your Left Hook API key',
                    },
                },
            },
        };
    }

    _jsonHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    // ---- Auth --------------------------------------------------------------

    /** GET /v1/auth/verify — prove the API key works. */
    async verifyAuth() {
        return this._get({ url: this.baseUrl + this.URLs.authVerify });
    }

    // ---- Companies ---------------------------------------------------------

    async listCompanies(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companies,
            query,
        });
    }

    async getCompany(id) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(id),
        });
    }

    async createCompany(data) {
        return this._post({
            url: this.baseUrl + this.URLs.companies,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async updateCompany(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.companyById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    async listInvoices(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.invoices,
            query,
        });
    }

    async getInvoice(id) {
        return this._get({
            url: this.baseUrl + this.URLs.invoiceById(id),
        });
    }

    async createInvoice(data) {
        return this._post({
            url: this.baseUrl + this.URLs.invoices,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async updateInvoice(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.invoiceById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async syncInvoiceFromXero(data) {
        return this._put({
            url: this.baseUrl + this.URLs.invoiceSyncXero,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Deals -------------------------------------------------------------

    async listDeals(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.deals,
            query,
        });
    }

    async getDeal(id) {
        return this._get({
            url: this.baseUrl + this.URLs.dealById(id),
        });
    }

    async createDeal(data) {
        return this._post({
            url: this.baseUrl + this.URLs.deals,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async updateDeal(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.dealById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async syncDealFromHubSpot(data) {
        return this._put({
            url: this.baseUrl + this.URLs.dealSyncHubSpot,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Project milestones ------------------------------------------------

    async listMilestones(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.milestones,
            query,
        });
    }

    async getMilestone(id) {
        return this._get({
            url: this.baseUrl + this.URLs.milestoneById(id),
        });
    }

    async createMilestone(data) {
        return this._post({
            url: this.baseUrl + this.URLs.milestones,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async updateMilestone(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.milestoneById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async syncMilestoneFromClickUp(data) {
        return this._put({
            url: this.baseUrl + this.URLs.milestoneSyncClickUp,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Bank accounts & balances ------------------------------------------

    async listBankAccounts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.bankAccounts,
            query,
        });
    }

    async getBankAccount(id) {
        return this._get({
            url: this.baseUrl + this.URLs.bankAccountById(id),
        });
    }

    async syncBankAccountFromMercury(data) {
        return this._put({
            url: this.baseUrl + this.URLs.bankAccountSyncMercury,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async createBalanceSnapshot(data) {
        return this._post({
            url: this.baseUrl + this.URLs.bankBalances,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Metrics -----------------------------------------------------------

    async getDeliveryMetrics() {
        return this._get({
            url: this.baseUrl + this.URLs.metricsDelivery,
        });
    }

    async getGTMMetrics() {
        return this._get({
            url: this.baseUrl + this.URLs.metricsGtm,
        });
    }

    async getFinanceMetrics() {
        return this._get({
            url: this.baseUrl + this.URLs.metricsFinance,
        });
    }

    async getAllMetrics() {
        return this._get({
            url: this.baseUrl + this.URLs.metrics,
        });
    }

    // ---- Daily snapshots ---------------------------------------------------

    async createDeliverySnapshot(data) {
        return this._post({
            url: this.baseUrl + this.URLs.snapshotDelivery,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async createGTMSnapshot(data) {
        return this._post({
            url: this.baseUrl + this.URLs.snapshotGtm,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async createFinanceSnapshot(data) {
        return this._post({
            url: this.baseUrl + this.URLs.snapshotFinance,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Sync status -------------------------------------------------------

    async createSyncStatus(data) {
        return this._post({
            url: this.baseUrl + this.URLs.syncStatus,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async updateSyncStatus(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.syncStatusById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Domain-model change requests --------------------------------------

    async listChangeRequests(params = {}) {
        const query = {};
        if (params.status != null) query.status = params.status;
        if (params.authorId != null) query.authorId = params.authorId;
        if (params.category != null) query.category = params.category;
        if (params.contentId != null) query.contentId = params.contentId;
        return this._get({
            url: this.baseUrl + this.URLs.changeRequests,
            query,
        });
    }

    async getChangeRequest(id) {
        return this._get({
            url: this.baseUrl + this.URLs.changeRequestById(id),
        });
    }

    async createChangeRequest(data) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequests,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async updateChangeRequest(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.changeRequestById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    async submitChangeRequest(id, actor) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequestSubmit(id),
            headers: this._jsonHeaders(),
            body: { actor },
        });
    }

    async approveChangeRequest(id, reviewer, comment) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequestApprove(id),
            headers: this._jsonHeaders(),
            body: { reviewer, comment },
        });
    }

    async rejectChangeRequest(id, reviewer, comment) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequestReject(id),
            headers: this._jsonHeaders(),
            body: { reviewer, comment },
        });
    }

    async withdrawChangeRequest(id, actor) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequestWithdraw(id),
            headers: this._jsonHeaders(),
            body: { actor },
        });
    }

    async markChangeRequestMerged(id, mergeCommit, externalRef) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequestMerged(id),
            headers: this._jsonHeaders(),
            body: { mergeCommit, externalRef },
        });
    }

    /**
     * Patch a change request's external reference (e.g. PR URL).
     * Caller must supply `actor` — no hardcoded framework identity.
     */
    async updateChangeRequestExternalRef(id, externalRef, actor) {
        return this._patch({
            url: this.baseUrl + this.URLs.changeRequestById(id),
            headers: this._jsonHeaders(),
            body: { externalRef, actor },
        });
    }

    /**
     * Register a webhook for change-request events.
     * body: { url, secret, events }
     */
    async registerChangeRequestWebhook(url, secret, events) {
        return this._post({
            url: this.baseUrl + this.URLs.changeRequestWebhook,
            headers: this._jsonHeaders(),
            body: { url, secret, events },
        });
    }

    // ---- Domain-model content (read-only) ----------------------------------

    async listDomainModelContent() {
        return this._get({
            url: this.baseUrl + this.URLs.domainModel,
        });
    }

    async getDomainModelCategory(category) {
        return this._get({
            url: this.baseUrl + this.URLs.domainModel,
            query: { category },
        });
    }

    async getDomainModelItem(category, id) {
        return this._get({
            url: this.baseUrl + this.URLs.domainModel,
            query: { category, id },
        });
    }

    async getDomainModelHistory(category, path) {
        return this._get({
            url: this.baseUrl + this.URLs.domainModelHistory,
            query: { category, path },
        });
    }

    async getDomainModelVersion(category, path, sha) {
        return this._get({
            url: this.baseUrl + this.URLs.domainModelHistory,
            query: { category, path, sha },
        });
    }
}

module.exports = { Api };
