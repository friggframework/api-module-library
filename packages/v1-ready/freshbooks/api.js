const { OAuth2Requester, get } = require('@friggframework/core');

const API_VERSION = 'alpha';
const WEB_APP = 'https://my.freshbooks.com/#';

/**
 * Invoice status codes from https://www.freshbooks.com/api/invoices
 * (status → display name).
 */
const INVOICE_STATUSES = {
    0: 'Disputed',
    1: 'Draft',
    2: 'Sent',
    3: 'Viewed',
    4: 'Paid',
    5: 'Auto Paid',
    6: 'Retry',
    7: 'Failed',
    8: 'Partial',
};

const jsonHeaders = () => ({
    'Content-Type': 'application/json',
    'Api-Version': API_VERSION,
});

/**
 * FreshBooks public API client.
 *
 * Auth: OAuth 2.0 authorization-code flow.
 *   Authorize: https://auth.freshbooks.com/oauth/authorize/
 *   Token:     POST https://api.freshbooks.com/auth/oauth/token (JSON body)
 *
 * Verified facts (https://www.freshbooks.com/api/ only):
 *   - Authorization codes expire in 5 minutes
 *   - Access-token lifetime varies; example responses show expires_in=43200 (12h)
 *   - Refresh tokens are one-time-use and rotate; codes are also single-use —
 *     token requests must not be retried after a lost 2xx (see _rawRequest)
 *   - Accounting paths require account_id; many non-accounting paths use business_id
 *   - No daily request cap; short bursts may return HTTP 429; list pages capped at 100
 *   - Webhook delivery is signed with X-FreshBooks-Hmac-SHA256
 *
 * FreshBooks publishes HTML docs + a Postman collection; there is no official
 * OpenAPI. ./freshbooks.openapi.yaml is a hand-written subset covering the
 * endpoints this client implements (one method per operationId).
 *
 * Prior art:
 *   - lefthookhq/freshbooks-integrations …/api-modules/freshbooks/ (Daniel)
 *   - lefthookhq/freshbooks--frigg (older TypeScript module) — bill_vendors + aliases
 *
 * Docs: https://www.freshbooks.com/api/start
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.freshbooks.com';
        this.authorizationUri = 'https://auth.freshbooks.com/oauth/authorize/';
        this.tokenUri = `${this.baseUrl}/auth/oauth/token`;

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
            get(params, 'scope', null) || process.env.FRESHBOOKS_SCOPE || null;
        this.state = get(params, 'state', null);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.freshbooksUserId = get(params, 'freshbooksUserId', null);
        this.accountId =
            get(params, 'accountId', null) || get(params, 'account_id', null);
        this.businessId =
            get(params, 'businessId', null) || get(params, 'business_id', null);

        this.URLs = {
            userDetails: '/auth/api/v1/users/me',
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
            billVendors: (accountId) =>
                `/accounting/account/${accountId}/bill_vendors/bill_vendors`,
            billVendor: (accountId, vendorId) =>
                `/accounting/account/${accountId}/bill_vendors/bill_vendors/${vendorId}`,
            callbacks: (accountId) =>
                `/events/account/${accountId}/events/callbacks`,
            callback: (accountId, callbackId) =>
                `/events/account/${accountId}/events/callbacks/${callbackId}`,
        };

        this.webUrls = {
            client: (clientId) => `${WEB_APP}/client/${clientId}`,
            invoice: (accountId, invoiceId) =>
                `${WEB_APP}/invoice/${accountId}-${invoiceId}`,
            invoices: (search) =>
                search
                    ? `${WEB_APP}/invoices?q=${encodeURIComponent(search)}`
                    : `${WEB_APP}/invoices`,
        };
    }

    invoiceStatusName(status) {
        return INVOICE_STATUSES[status] ?? '';
    }

    /**
     * OAuth authorize URL.
     * Official: https://auth.freshbooks.com/oauth/authorize/?response_type=code&redirect_uri=&client_id=
     * Scopes are configured on the FreshBooks app (not required in the URL).
     */
    getAuthorizationUri() {
        const query = new URLSearchParams({
            client_id: this.client_id || '',
            response_type: 'code',
            redirect_uri: this.redirect_uri || '',
        });
        if (this.state) query.set('state', this.state);
        if (this.scope) query.set('scope', this.scope);
        return `${this.authorizationUri}?${query}`;
    }

    /** Alias used by Definition.getAuthorizationRequirements */
    getAuthUri(params = {}) {
        if (params.redirect_uri) this.redirect_uri = params.redirect_uri;
        if (params.state) this.state = params.state;
        return this.getAuthorizationUri();
    }

    setAccountId(accountId) {
        this.accountId = accountId;
    }

    setBusinessId(businessId) {
        this.businessId = businessId;
    }

    setAccessToken(access_token) {
        this.access_token = access_token;
    }

    setRefreshToken(refresh_token) {
        this.refresh_token = refresh_token;
    }

    setRedirectUri(redirectUri) {
        this.redirect_uri = redirectUri;
    }

    requireAccountId(explicit) {
        const accountId = explicit || this.accountId;
        if (!accountId) {
            throw new Error(
                'FreshBooks accountId is required for accounting/events paths. ' +
                    'Pass accountId or call setAccountId() after reading business_memberships from getUserDetails().'
            );
        }
        return accountId;
    }

    /**
     * Allow (accountId, opts) or (opts) when this.accountId is already set.
     */
    _accountAndOpts(accountIdOrOpts, opts) {
        if (
            accountIdOrOpts &&
            typeof accountIdOrOpts === 'object' &&
            !Array.isArray(accountIdOrOpts)
        ) {
            return {
                accountId: this.requireAccountId(undefined),
                opts: accountIdOrOpts,
            };
        }
        return {
            accountId: this.requireAccountId(accountIdOrOpts),
            opts: opts || {},
        };
    }

    async addAuthHeaders(headers = {}) {
        const authHeaders = await super.addAuthHeaders(headers);
        authHeaders['Api-Version'] = API_VERSION;
        return authHeaders;
    }

    /**
     * FreshBooks refresh tokens and auth codes are single-use: a retry after a
     * lost 2xx re-sends a grant FreshBooks already consumed. Jump past the
     * backoff slots so the token request is sent once.
     */
    async _rawRequest(url, options, attempt = 0) {
        const tokenRequestAttempt =
            url === this.tokenUri ? this.backOff.length : attempt;
        return super._rawRequest(url, options, tokenRequestAttempt);
    }

    async getTokenFromCode(code) {
        return this._requestToken({
            grant_type: 'authorization_code',
            code,
        });
    }

    async refreshAccessToken({ refresh_token }) {
        this.access_token = undefined;
        return this._requestToken({
            grant_type: 'refresh_token',
            refresh_token,
        });
    }

    /**
     * Token exchange/refresh with JSON body (official Authentication docs).
     * client_id + client_secret travel in the body, not Basic auth.
     */
    async _requestToken(grantFields) {
        const response = await this._post({
            url: this.tokenUri,
            headers: jsonHeaders(),
            body: {
                client_id: this.client_id,
                client_secret: this.client_secret,
                redirect_uri: this.redirect_uri,
                ...grantFields,
            },
        });
        await this.setTokens(response);
        return response;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Identity info for the authorized user.
     * GET /auth/api/v1/users/me — Scope: user:profile:read
     * Returns the unwrapped identity object (inside `response`).
     * Sets this.freshbooksUserId for credential persistence.
     */
    async getUserDetails() {
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.userDetails,
        });
        if (response?.id == null) {
            throw new Error(
                'FreshBooks users/me response is missing the user id'
            );
        }
        this.freshbooksUserId = String(response.id);
        return response;
    }

    /** Alias kept for callers that used getUserInfo; same as getUserDetails. */
    async getUserInfo() {
        return this.getUserDetails();
    }

    /** Convenience from older TS module: email only from /users/me. */
    async getUserEmail() {
        const user = await this.getUserDetails();
        return user.email;
    }

    /**
     * Convenience: map business_memberships to { name, accountId, businessId, role }.
     */
    async listBusinessAccounts() {
        const user = await this.getUserDetails();
        return (user.business_memberships || [])
            .map((mem) => ({
                name: mem.business?.name,
                accountId: mem.business?.account_id,
                businessId: mem.business?.id,
                role: mem.role,
                membershipId: mem.id,
            }))
            .filter((a) => a.accountId);
    }

    /**
     * Older TS module shape: [{ name, id }] where id is account_id.
     * Prefer listBusinessAccounts() for new callers.
     */
    async retrieveAccounts() {
        const accounts = await this.listBusinessAccounts();
        return accounts.map((a) => ({ name: a.name, id: a.accountId }));
    }

    // ---- Clients -----------------------------------------------------------

    /** GET /accounting/account/{accountId}/users/clients */
    async listClients(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        const { page = 1, perPage = 100, ...rest } = resolved.opts;
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.clients(resolved.accountId),
            query: {
                page,
                per_page: perPage,
                sort: 'updated_desc',
                ...rest,
            },
        });
        const { clients, pages } = response.result;
        return { clients, pages };
    }

    /** GET /accounting/account/{accountId}/users/clients/{clientId} */
    async getClient(accountId, clientId) {
        if (typeof accountId !== 'string') {
            clientId = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.client(id, clientId),
        });
        return response.result.client;
    }

    /**
     * GET clients filtered by exact email (search[email]).
     * Docs: https://www.freshbooks.com/api/clients
     */
    async findClientsByEmail(accountId, email) {
        if (arguments.length === 1) {
            email = accountId;
            accountId = undefined;
        }
        if (typeof email !== 'string' || !email.trim()) {
            throw new Error('findClientsByEmail requires a non-empty email');
        }
        const id = this.requireAccountId(accountId);
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.clients(id),
            query: {
                'search[email]': email.trim(),
                sort: 'updated_desc',
            },
        });
        return response.result.clients;
    }

    /** Alias from lefthookhq/freshbooks--frigg */
    async searchClientByEmail(accountId, email) {
        return this.findClientsByEmail(accountId, email);
    }

    /** Alias from lefthookhq/freshbooks--frigg */
    async getClientById(accountId, clientId) {
        return this.getClient(accountId, clientId);
    }

    /** POST /accounting/account/{accountId}/users/clients */
    async createClient(accountId, client) {
        if (arguments.length === 1) {
            client = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const payload = client?.client ? client : { client };
        const { response } = await this._post({
            url: this.baseUrl + this.URLs.clients(id),
            headers: jsonHeaders(),
            body: payload,
        });
        return response.result.client;
    }

    /** PUT /accounting/account/{accountId}/users/clients/{clientId} */
    async updateClient(accountId, clientId, client) {
        if (arguments.length === 2) {
            client = clientId;
            clientId = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const payload = client?.client ? client : { client };
        const { response } = await this._put({
            url: this.baseUrl + this.URLs.client(id, clientId),
            headers: jsonHeaders(),
            body: payload,
        });
        return response.result.client;
    }

    // ---- Invoices ----------------------------------------------------------

    /** GET /accounting/account/{accountId}/invoices/invoices */
    async listInvoices(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.invoices(resolved.accountId),
            query: resolved.opts,
        });
        return response;
    }

    /** GET invoices for one client (search[customerid]) */
    async listClientInvoices(accountId, clientId, perPage) {
        // Allow (clientId, perPage?) when this.accountId is already set.
        if (typeof accountId !== 'string') {
            perPage = clientId;
            clientId = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const query = {
            'search[customerid]': clientId,
            sort: 'invoice_date_desc',
        };
        if (perPage != null) query.per_page = perPage;
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.invoices(id),
            query,
        });
        return {
            records: response.result.invoices,
            total: response.result.total,
        };
    }

    /** Alias from lefthookhq/freshbooks--frigg */
    async getClientInvoices(accountId, clientId, perPage) {
        return this.listClientInvoices(accountId, clientId, perPage);
    }

    /** GET /accounting/account/{accountId}/invoices/invoices/{invoiceId} */
    async getInvoice(accountId, invoiceId) {
        let acct = accountId;
        let iid = invoiceId;
        if (arguments.length === 1) {
            iid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.invoice(id, iid),
        });
        return response.result.invoice;
    }

    /** Alias from lefthookhq/freshbooks--frigg */
    async getInvoiceById(accountId, invoiceId) {
        return this.getInvoice(accountId, invoiceId);
    }

    /** POST /accounting/account/{accountId}/invoices/invoices */
    async createInvoice(accountId, invoice) {
        let acct = accountId;
        let body = invoice;
        if (arguments.length === 1) {
            body = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.invoice ? body : { invoice: body };
        const { response } = await this._post({
            url: this.baseUrl + this.URLs.invoices(id),
            headers: jsonHeaders(),
            body: payload,
        });
        return response.result?.invoice ?? response;
    }

    /** PUT /accounting/account/{accountId}/invoices/invoices/{invoiceId} */
    async updateInvoice(accountId, invoiceId, invoice) {
        let acct = accountId;
        let iid = invoiceId;
        let body = invoice;
        if (arguments.length === 2) {
            body = invoiceId;
            iid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.invoice ? body : { invoice: body };
        const { response } = await this._put({
            url: this.baseUrl + this.URLs.invoice(id, iid),
            headers: jsonHeaders(),
            body: payload,
        });
        return response.result?.invoice ?? response;
    }

    /** DELETE /accounting/account/{accountId}/invoices/invoices/{invoiceId} */
    async deleteInvoice(accountId, invoiceId) {
        let acct = accountId;
        let iid = invoiceId;
        if (arguments.length === 1) {
            iid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        return this._delete({
            url: this.baseUrl + this.URLs.invoice(id, iid),
        });
    }

    // ---- Expenses ----------------------------------------------------------

    async listExpenses(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        return this._get({
            url: this.baseUrl + this.URLs.expenses(resolved.accountId),
            query: resolved.opts,
        });
    }

    async getExpense(accountId, expenseId) {
        let acct = accountId;
        let eid = expenseId;
        if (arguments.length === 1) {
            eid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        return this._get({
            url: this.baseUrl + this.URLs.expense(id, eid),
        });
    }

    async createExpense(accountId, expense) {
        let acct = accountId;
        let body = expense;
        if (arguments.length === 1) {
            body = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.expense ? body : { expense: body };
        return this._post({
            url: this.baseUrl + this.URLs.expenses(id),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    async updateExpense(accountId, expenseId, expense) {
        let acct = accountId;
        let eid = expenseId;
        let body = expense;
        if (arguments.length === 2) {
            body = expenseId;
            eid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.expense ? body : { expense: body };
        return this._put({
            url: this.baseUrl + this.URLs.expense(id, eid),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    async listExpenseCategories(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.expenseCategories(resolved.accountId),
            query: resolved.opts,
        });
    }

    async getExpenseCategory(accountId, categoryId) {
        let acct = accountId;
        let cid = categoryId;
        if (arguments.length === 1) {
            cid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        return this._get({
            url: this.baseUrl + this.URLs.expenseCategory(id, cid),
        });
    }

    // ---- Payments ----------------------------------------------------------

    async listPayments(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        return this._get({
            url: this.baseUrl + this.URLs.payments(resolved.accountId),
            query: resolved.opts,
        });
    }

    /** GET payments for one client (search[clientid]) with invoice include */
    async listClientPayments(accountId, clientId, perPage) {
        if (typeof accountId !== 'string') {
            perPage = clientId;
            clientId = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const query = {
            'search[clientid]': clientId,
            'include[]': 'invoice',
            sort: 'updated_desc',
        };
        if (perPage != null) query.per_page = perPage;
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.payments(id),
            query,
        });
        return {
            records: response.result.payments,
            total: response.result.total,
        };
    }

    /** Alias from lefthookhq/freshbooks--frigg */
    async getClientPayments(accountId, clientId, perPage) {
        return this.listClientPayments(accountId, clientId, perPage);
    }

    /**
     * GET /accounting/account/{accountId}/payments/payments/{paymentId}
     * Includes related invoice by default (include[]=invoice).
     */
    async getPayment(accountId, paymentId) {
        let acct = accountId;
        let pid = paymentId;
        if (arguments.length === 1) {
            pid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.payment(id, pid),
            query: { 'include[]': 'invoice' },
        });
        return response.result.payment;
    }

    /** Alias from lefthookhq/freshbooks--frigg */
    async getPaymentById(accountId, paymentId) {
        return this.getPayment(accountId, paymentId);
    }

    async createPayment(accountId, payment) {
        let acct = accountId;
        let body = payment;
        if (arguments.length === 1) {
            body = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.payment ? body : { payment: body };
        return this._post({
            url: this.baseUrl + this.URLs.payments(id),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    async updatePayment(accountId, paymentId, payment) {
        let acct = accountId;
        let pid = paymentId;
        let body = payment;
        if (arguments.length === 2) {
            body = paymentId;
            pid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.payment ? body : { payment: body };
        return this._put({
            url: this.baseUrl + this.URLs.payment(id, pid),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    // ---- Staff -------------------------------------------------------------

    async listStaff(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        return this._get({
            url: this.baseUrl + this.URLs.staffs(resolved.accountId),
            query: resolved.opts,
        });
    }

    async getStaff(accountId, staffId) {
        let acct = accountId;
        let sid = staffId;
        if (arguments.length === 1) {
            sid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        return this._get({
            url: this.baseUrl + this.URLs.staff(id, sid),
        });
    }

    // ---- Other income ------------------------------------------------------

    async listOtherIncomes(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        return this._get({
            url: this.baseUrl + this.URLs.otherIncomes(resolved.accountId),
            query: resolved.opts,
        });
    }

    async getOtherIncome(accountId, incomeId) {
        let acct = accountId;
        let iid = incomeId;
        if (arguments.length === 1) {
            iid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        return this._get({
            url: this.baseUrl + this.URLs.otherIncome(id, iid),
        });
    }

    async createOtherIncome(accountId, otherIncome) {
        let acct = accountId;
        let body = otherIncome;
        if (arguments.length === 1) {
            body = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.other_income
            ? body
            : { other_income: body };
        return this._post({
            url: this.baseUrl + this.URLs.otherIncomes(id),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    async updateOtherIncome(accountId, incomeId, otherIncome) {
        let acct = accountId;
        let iid = incomeId;
        let body = otherIncome;
        if (arguments.length === 2) {
            body = incomeId;
            iid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.other_income
            ? body
            : { other_income: body };
        return this._put({
            url: this.baseUrl + this.URLs.otherIncome(id, iid),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    // ---- Bill vendors (Accounts Payable) -----------------------------------
    // Docs: https://www.freshbooks.com/api/vendors
    // Scopes: user:bill_vendors:read / user:bill_vendors:write
    // Present in lefthookhq/freshbooks--frigg (list + create).

    /** GET /accounting/account/{accountId}/bill_vendors/bill_vendors */
    async listBillVendors(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        return this._get({
            url: this.baseUrl + this.URLs.billVendors(resolved.accountId),
            query: resolved.opts,
        });
    }

    /** POST /accounting/account/{accountId}/bill_vendors/bill_vendors */
    async createBillVendor(accountId, billVendor) {
        if (arguments.length === 1) {
            billVendor = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const payload = billVendor?.bill_vendor
            ? billVendor
            : { bill_vendor: billVendor };
        return this._post({
            url: this.baseUrl + this.URLs.billVendors(id),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    /**
     * PUT /accounting/account/{accountId}/bill_vendors/bill_vendors/{vendorId}
     * Also used to soft-delete via vis_state=1.
     */
    async updateBillVendor(accountId, vendorId, billVendor) {
        if (arguments.length === 2) {
            billVendor = vendorId;
            vendorId = accountId;
            accountId = undefined;
        }
        const id = this.requireAccountId(accountId);
        const payload = billVendor?.bill_vendor
            ? billVendor
            : { bill_vendor: billVendor };
        return this._put({
            url: this.baseUrl + this.URLs.billVendor(id, vendorId),
            headers: jsonHeaders(),
            body: payload,
        });
    }

    // ---- Webhook callbacks -------------------------------------------------

    async listCallbacks(accountId, opts = {}) {
        const resolved = this._accountAndOpts(accountId, opts);
        const { page = 1, perPage = 100 } = resolved.opts;
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.callbacks(resolved.accountId),
            query: { page, per_page: perPage },
        });
        const { callbacks, pages } = response.result;
        return { callbacks, pages };
    }

    /** GET /events/account/{accountId}/events/callbacks/{callbackId} */
    async getCallback(accountId, callbackId) {
        let acct = accountId;
        let cid = callbackId;
        if (arguments.length === 1) {
            cid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const { response } = await this._get({
            url: this.baseUrl + this.URLs.callback(id, cid),
        });
        return response.result.callback;
    }

    async createCallback(accountId, data) {
        let acct = accountId;
        let body = data;
        if (arguments.length === 1) {
            body = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const payload = body?.callback ? body : { callback: body };
        const { response } = await this._post({
            url: this.baseUrl + this.URLs.callbacks(id),
            headers: jsonHeaders(),
            body: payload,
        });
        return response.result.callback;
    }

    /**
     * PUT verify — body includes callback_id + verifier
     * (reconciled with lefthookhq/freshbooks-integrations module).
     */
    async verifyCallback(accountId, callbackId, verifier) {
        let acct = accountId;
        let cid = callbackId;
        let ver = verifier;
        if (arguments.length === 2) {
            ver = callbackId;
            cid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const { response } = await this._put({
            url: this.baseUrl + this.URLs.callback(id, cid),
            headers: jsonHeaders(),
            body: {
                callback: { callback_id: cid, verifier: ver },
            },
        });
        return response.result.callback;
    }

    async resendCallbackVerification(accountId, callbackId) {
        let acct = accountId;
        let cid = callbackId;
        if (arguments.length === 1) {
            cid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        const { response } = await this._put({
            url: this.baseUrl + this.URLs.callback(id, cid),
            headers: jsonHeaders(),
            body: { callback: { resend: true } },
        });
        return response.result.callback;
    }

    async deleteCallback(accountId, callbackId) {
        let acct = accountId;
        let cid = callbackId;
        if (arguments.length === 1) {
            cid = accountId;
            acct = undefined;
        }
        const id = this.requireAccountId(acct);
        await this._delete({
            url: this.baseUrl + this.URLs.callback(id, cid),
        });
    }

    /** Aliases from lefthookhq/freshbooks--frigg */
    async createEventCallback(accountId, data) {
        return this.createCallback(accountId, data);
    }

    async verifyEventCallback(accountId, callbackId, verifier) {
        return this.verifyCallback(accountId, callbackId, verifier);
    }

    async deleteEventCallback(accountId, callbackId) {
        return this.deleteCallback(accountId, callbackId);
    }
}

module.exports = { Api, INVOICE_STATUSES, API_VERSION };
