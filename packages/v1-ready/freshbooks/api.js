const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * FreshBooks public API client.
 *
 * Auth: OAuth 2.0 authorization-code flow.
 *   Authorize: https://auth.freshbooks.com/oauth/authorize/
 *   Token:     POST https://api.freshbooks.com/auth/oauth/token
 *
 * Verified facts (https://www.freshbooks.com/api/ only):
 *   - Authorization codes expire in 5 minutes
 *   - Access-token lifetime varies; example responses show expires_in=43200 (12h)
 *   - Refresh tokens are long-lived but one-time-use; each refresh returns a new
 *     refresh_token and invalidates the previous one (and the previous access token)
 *   - Accounting paths require account_id; many non-accounting paths use business_id
 *   - No daily request cap; short bursts may return HTTP 429; list pages capped at 100
 *   - Webhook delivery is signed with X-FreshBooks-Hmac-SHA256 (HMAC-SHA256 of a
 *     spaced JSON encoding of the form params, secret = callback verifier)
 *
 * FreshBooks publishes HTML docs + a Postman collection; there is no official
 * OpenAPI. ./freshbooks.openapi.yaml is a hand-written subset covering the
 * endpoints this client implements (one method per operationId).
 *
 * Docs: https://www.freshbooks.com/api/start
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.freshbooks.com';
        this.client_id =
            get(params, 'client_id', null) || process.env.FRESHBOOKS_CLIENT_ID;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.FRESHBOOKS_CLIENT_SECRET;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            process.env.REDIRECT_URI ||
            null;
        this.scope =
            get(params, 'scope', null) ||
            process.env.FRESHBOOKS_SCOPE ||
            [
                'user:profile:read',
                'user:clients:read',
                'user:clients:write',
                'user:invoices:read',
                'user:invoices:write',
                'user:expenses:read',
                'user:expenses:write',
                'user:payments:read',
                'user:payments:write',
                'user:other_income:read',
                'user:other_income:write',
                'user:teams:read',
            ].join(' ');

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.accountId =
            get(params, 'accountId', null) || get(params, 'account_id', null);
        this.businessId =
            get(params, 'businessId', null) ||
            get(params, 'business_id', null);

        this.tokenUri = `${this.baseUrl}/auth/oauth/token`;
        this.authorizationUri = this.buildAuthorizationUri();

        this.URLs = {
            identity: '/auth/api/v1/users/me',
            clients: (accountId) =>
                `/accounting/account/${accountId}/users/clients`,
            client: (accountId, clientId) =>
                `/accounting/account/${accountId}/users/clients/${clientId}`,
            invoices: (accountId) =>
                `/accounting/account/${accountId}/invoices/invoices`,
            invoice: (accountId, invoiceId) =>
                `/accounting/account/${accountId}/invoices/invoices/${invoiceId}`,
            expenses: (accountId) =>
                `/accounting/account/${accountId}/expenses/expenses`,
            expense: (accountId, expenseId) =>
                `/accounting/account/${accountId}/expenses/expenses/${expenseId}`,
            expenseCategories: (accountId) =>
                `/accounting/account/${accountId}/expenses/categories`,
            expenseCategory: (accountId, categoryId) =>
                `/accounting/account/${accountId}/expenses/categories/${categoryId}`,
            payments: (accountId) =>
                `/accounting/account/${accountId}/payments/payments`,
            payment: (accountId, paymentId) =>
                `/accounting/account/${accountId}/payments/payments/${paymentId}`,
            staffs: (accountId) =>
                `/accounting/account/${accountId}/users/staffs`,
            staff: (accountId, staffId) =>
                `/accounting/account/${accountId}/users/staffs/${staffId}`,
            otherIncomes: (accountId) =>
                `/accounting/account/${accountId}/other_incomes/other_incomes`,
            otherIncome: (accountId, incomeId) =>
                `/accounting/account/${accountId}/other_incomes/other_incomes/${incomeId}`,
            callbacks: (accountId) =>
                `/events/account/${accountId}/events/callbacks`,
            callback: (accountId, callbackId) =>
                `/events/account/${accountId}/events/callbacks/${callbackId}`,
        };
    }

    buildAuthorizationUri(redirectUri) {
        const redirect = redirectUri || this.redirect_uri || '';
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: redirect,
        });
        if (this.scope) params.set('scope', this.scope);
        return `https://auth.freshbooks.com/oauth/authorize/?${params.toString()}`;
    }

    /**
     * OAuth authorize URL for the current client_id / redirect_uri / scope.
     * Official format: https://www.freshbooks.com/api/authentication
     */
    getAuthUri(params = {}) {
        const redirect =
            params.redirect_uri || this.redirect_uri || process.env.REDIRECT_URI;
        this.authorizationUri = this.buildAuthorizationUri(redirect);
        return this.authorizationUri;
    }

    setAccountId(accountId) {
        this.accountId = accountId;
    }

    setBusinessId(businessId) {
        this.businessId = businessId;
    }

    requireAccountId(explicit) {
        const accountId = explicit || this.accountId;
        if (!accountId) {
            throw new Error(
                'FreshBooks accountId is required for accounting/events paths. ' +
                    'Call setAccountId() after reading business_memberships from getUserInfo().'
            );
        }
        return accountId;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else if (typeof value === 'object') {
                for (const [innerKey, innerVal] of Object.entries(value)) {
                    if (innerVal === undefined || innerVal === null) continue;
                    if (Array.isArray(innerVal)) {
                        for (const v of innerVal) {
                            usp.append(`${key}[${innerKey}][]`, String(v));
                        }
                    } else {
                        usp.append(`${key}[${innerKey}]`, String(innerVal));
                    }
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        // Official /users/me example sends Api-Version: alpha
        // (https://www.freshbooks.com/api/identity_model).
        next['Api-Version'] = next['Api-Version'] || 'alpha';
        next['Content-Type'] = next['Content-Type'] || 'application/json';
        return next;
    }

    /**
     * Exchange an authorization code for tokens.
     * FreshBooks accepts application/x-www-form-urlencoded (or JSON) with
     * client_id + client_secret in the body — matching OAuth2Requester's
     * default getTokenFromCode(). Refresh responses include a new refresh_token;
     * setTokens() persists the rotation.
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Identity info for the authorized user.
     * GET /auth/api/v1/users/me
     * Scope: user:profile:read
     */
    async getUserInfo() {
        return this._get({
            url: this.baseUrl + this.URLs.identity,
        });
    }

    /**
     * Convenience: map business_memberships to { name, accountId, businessId, role }.
     */
    async listBusinessAccounts() {
        const res = await this.getUserInfo();
        const memberships = res?.response?.business_memberships || [];
        return memberships.map((mem) => ({
            name: mem.business?.name,
            accountId: mem.business?.account_id,
            businessId: mem.business?.id,
            role: mem.role,
            membershipId: mem.id,
        }));
    }

    // ---- Clients -----------------------------------------------------------

    /** GET /accounting/account/{accountId}/users/clients */
    async listClients(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.clients(id) +
                this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/users/clients/{clientId} */
    async getClient(clientId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.client(id, clientId) +
                this._buildQuery(params),
        });
    }

    /** POST /accounting/account/{accountId}/users/clients  body: { client: {...} } */
    async createClient(data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.client ? data : { client: data };
        return this._post({
            url: this.baseUrl + this.URLs.clients(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /accounting/account/{accountId}/users/clients/{clientId} */
    async updateClient(clientId, data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.client ? data : { client: data };
        return this._put({
            url: this.baseUrl + this.URLs.client(id, clientId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /** GET /accounting/account/{accountId}/invoices/invoices */
    async listInvoices(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.invoices(id) +
                this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/invoices/invoices/{invoiceId} */
    async getInvoice(invoiceId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.invoice(id, invoiceId) +
                this._buildQuery(params),
        });
    }

    /** POST /accounting/account/{accountId}/invoices/invoices */
    async createInvoice(data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.invoice ? data : { invoice: data };
        return this._post({
            url: this.baseUrl + this.URLs.invoices(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /accounting/account/{accountId}/invoices/invoices/{invoiceId} */
    async updateInvoice(invoiceId, data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.invoice ? data : { invoice: data };
        return this._put({
            url: this.baseUrl + this.URLs.invoice(id, invoiceId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** DELETE /accounting/account/{accountId}/invoices/invoices/{invoiceId} */
    async deleteInvoice(invoiceId, accountId) {
        const id = this.requireAccountId(accountId);
        return this._delete({
            url: this.baseUrl + this.URLs.invoice(id, invoiceId),
        });
    }

    // ---- Expenses ----------------------------------------------------------

    /** GET /accounting/account/{accountId}/expenses/expenses */
    async listExpenses(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.expenses(id) +
                this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/expenses/expenses/{expenseId} */
    async getExpense(expenseId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.expense(id, expenseId) +
                this._buildQuery(params),
        });
    }

    /** POST /accounting/account/{accountId}/expenses/expenses */
    async createExpense(data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.expense ? data : { expense: data };
        return this._post({
            url: this.baseUrl + this.URLs.expenses(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /accounting/account/{accountId}/expenses/expenses/{expenseId} */
    async updateExpense(expenseId, data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.expense ? data : { expense: data };
        return this._put({
            url: this.baseUrl + this.URLs.expense(id, expenseId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** GET /accounting/account/{accountId}/expenses/categories */
    async listExpenseCategories(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.expenseCategories(id) +
                this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/expenses/categories/{categoryId} */
    async getExpenseCategory(categoryId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.expenseCategory(id, categoryId) +
                this._buildQuery(params),
        });
    }

    // ---- Payments ----------------------------------------------------------

    /** GET /accounting/account/{accountId}/payments/payments */
    async listPayments(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.payments(id) +
                this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/payments/payments/{paymentId} */
    async getPayment(paymentId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.payment(id, paymentId) +
                this._buildQuery(params),
        });
    }

    /** POST /accounting/account/{accountId}/payments/payments */
    async createPayment(data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.payment ? data : { payment: data };
        return this._post({
            url: this.baseUrl + this.URLs.payments(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /accounting/account/{accountId}/payments/payments/{paymentId} */
    async updatePayment(paymentId, data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.payment ? data : { payment: data };
        return this._put({
            url: this.baseUrl + this.URLs.payment(id, paymentId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Staff -------------------------------------------------------------

    /** GET /accounting/account/{accountId}/users/staffs */
    async listStaff(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl + this.URLs.staffs(id) + this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/users/staffs/{staffId} */
    async getStaff(staffId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.staff(id, staffId) +
                this._buildQuery(params),
        });
    }

    // ---- Other income ------------------------------------------------------

    /** GET /accounting/account/{accountId}/other_incomes/other_incomes */
    async listOtherIncomes(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.otherIncomes(id) +
                this._buildQuery(params),
        });
    }

    /** GET /accounting/account/{accountId}/other_incomes/other_incomes/{incomeId} */
    async getOtherIncome(incomeId, params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.otherIncome(id, incomeId) +
                this._buildQuery(params),
        });
    }

    /** POST /accounting/account/{accountId}/other_incomes/other_incomes */
    async createOtherIncome(data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.other_income ? data : { other_income: data };
        return this._post({
            url: this.baseUrl + this.URLs.otherIncomes(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /accounting/account/{accountId}/other_incomes/other_incomes/{incomeId} */
    async updateOtherIncome(incomeId, data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.other_income ? data : { other_income: data };
        return this._put({
            url: this.baseUrl + this.URLs.otherIncome(id, incomeId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Webhook callbacks -------------------------------------------------

    /** GET /events/account/{accountId}/events/callbacks */
    async listCallbacks(params = {}, accountId) {
        const id = this.requireAccountId(accountId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.callbacks(id) +
                this._buildQuery(params),
        });
    }

    /**
     * POST /events/account/{accountId}/events/callbacks
     * body: { callback: { event, uri } }
     * FreshBooks then POSTs a verifier to the URI; call verifyCallback next.
     */
    async createCallback(data, accountId) {
        const id = this.requireAccountId(accountId);
        const body = data?.callback ? data : { callback: data };
        return this._post({
            url: this.baseUrl + this.URLs.callbacks(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * PUT /events/account/{accountId}/events/callbacks/{callbackId}
     * body: { callback: { verifier } }
     */
    async verifyCallback(callbackId, verifier, accountId) {
        const id = this.requireAccountId(accountId);
        return this._put({
            url: this.baseUrl + this.URLs.callback(id, callbackId),
            headers: { 'Content-Type': 'application/json' },
            body: { callback: { verifier } },
        });
    }

    /**
     * PUT /events/account/{accountId}/events/callbacks/{callbackId}
     * body: { callback: { resend: true } }
     */
    async resendCallbackVerification(callbackId, accountId) {
        const id = this.requireAccountId(accountId);
        return this._put({
            url: this.baseUrl + this.URLs.callback(id, callbackId),
            headers: { 'Content-Type': 'application/json' },
            body: { callback: { resend: true } },
        });
    }

    /** DELETE /events/account/{accountId}/events/callbacks/{callbackId} */
    async deleteCallback(callbackId, accountId) {
        const id = this.requireAccountId(accountId);
        return this._delete({
            url: this.baseUrl + this.URLs.callback(id, callbackId),
        });
    }
}

module.exports = { Api };
