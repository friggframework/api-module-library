const { OAuth2Requester, get } = require('@friggframework/core');
const crypto = require('crypto');

/**
 * Salesloft Public API client.
 *
 * Auth: OAuth 2.0 Authorization Code (partners) — Bearer access token.
 *   Authorize: https://accounts.salesloft.com/oauth/authorize
 *   Token:     https://accounts.salesloft.com/oauth/token
 *   Docs:      https://developers.salesloft.com/docs/platform/api-basics/oauth-authentication/
 *
 * Base URL: https://api.salesloft.com/v2
 * Paths do NOT use a `.json` suffix (v2 docs).
 * Rate limit: 600 cost/minute team-wide.
 * Envelope: { data, metadata } — errors use `error` / `errors`.
 *
 * Docs: https://developers.salesloft.com/
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.salesloft.com/v2';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            me: '/me',
            team: '/team',
            people: '/people',
            personById: (id) => `/people/${id}`,
            accounts: '/accounts',
            accountById: (id) => `/accounts/${id}`,
            users: '/users',
            userById: (id) => `/users/${id}`,
            tasks: '/tasks',
            taskById: (id) => `/tasks/${id}`,
            webhookSubscriptions: '/webhook_subscriptions',
            webhookSubscriptionById: (id) => `/webhook_subscriptions/${id}`,
        };

        this.authorizationUri = encodeURI(
            `https://accounts.salesloft.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code`
        );
        this.tokenUri = 'https://accounts.salesloft.com/oauth/token';
    }

    getAuthorizationUri() {
        return this.authorizationUri;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Fetch the authenticated user.
     * GET /v2/me
     * https://developers.salesloft.com/docs/api/me-index/
     */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    /**
     * Fetch the authenticated user's team.
     * GET /v2/team
     * https://developers.salesloft.com/docs/api/team-index/
     */
    async getTeam() {
        return this._get({ url: this.baseUrl + this.URLs.team });
    }

    // ---- People ------------------------------------------------------------

    /**
     * List people.
     * GET /v2/people
     * https://developers.salesloft.com/docs/api/people-index/
     */
    async listPeople(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.people,
            query: params,
        });
    }

    /**
     * Fetch a person by id.
     * GET /v2/people/{id}
     * https://developers.salesloft.com/docs/api/people-show/
     */
    async getPerson(id) {
        return this._get({
            url: this.baseUrl + this.URLs.personById(id),
        });
    }

    /**
     * Create a person. Either email_address or phone/last_name required.
     * POST /v2/people
     * https://developers.salesloft.com/docs/api/people-create/
     */
    async createPerson(person) {
        return this._post({
            url: this.baseUrl + this.URLs.people,
            headers: { 'Content-Type': 'application/json' },
            body: person,
        });
    }

    /**
     * Update a person.
     * PUT /v2/people/{id}
     * https://developers.salesloft.com/docs/api/people-update/
     */
    async updatePerson(id, person) {
        return this._put({
            url: this.baseUrl + this.URLs.personById(id),
            headers: { 'Content-Type': 'application/json' },
            body: person,
        });
    }

    /**
     * Delete a person (irreversible without support).
     * DELETE /v2/people/{id}
     * https://developers.salesloft.com/docs/api/people-destroy/
     */
    async deletePerson(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.personById(id),
        });
    }

    // ---- Accounts ----------------------------------------------------------

    /**
     * List accounts.
     * GET /v2/accounts
     * https://developers.salesloft.com/docs/api/accounts-index/
     */
    async listAccounts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query: params,
        });
    }

    /**
     * Fetch an account by id.
     * GET /v2/accounts/{id}
     * https://developers.salesloft.com/docs/api/accounts-show/
     */
    async getAccount(id) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(id),
        });
    }

    /**
     * Create an account. `domain` must be unique on the team.
     * POST /v2/accounts
     * https://developers.salesloft.com/docs/api/accounts-create/
     */
    async createAccount(account) {
        return this._post({
            url: this.baseUrl + this.URLs.accounts,
            headers: { 'Content-Type': 'application/json' },
            body: account,
        });
    }

    /**
     * Update an account.
     * PUT /v2/accounts/{id}
     * https://developers.salesloft.com/docs/api/accounts-update/
     */
    async updateAccount(id, account) {
        return this._put({
            url: this.baseUrl + this.URLs.accountById(id),
            headers: { 'Content-Type': 'application/json' },
            body: account,
        });
    }

    /**
     * Delete an account.
     * DELETE /v2/accounts/{id}
     * https://developers.salesloft.com/docs/api/accounts-destroy/
     */
    async deleteAccount(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.accountById(id),
        });
    }

    // ---- Users -------------------------------------------------------------

    /**
     * List users on the team.
     * GET /v2/users
     * https://developers.salesloft.com/docs/api/users-index/
     */
    async listUsers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query: params,
        });
    }

    /**
     * Fetch a user by id or guid.
     * GET /v2/users/{id}
     * https://developers.salesloft.com/docs/api/users-show/
     */
    async getUser(id) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(id),
        });
    }

    /**
     * Update a user.
     * PUT /v2/users/{id}
     * https://developers.salesloft.com/docs/api/users-update/
     */
    async updateUser(id, user) {
        return this._put({
            url: this.baseUrl + this.URLs.userById(id),
            headers: { 'Content-Type': 'application/json' },
            body: user,
        });
    }

    // ---- Tasks -------------------------------------------------------------

    /**
     * List tasks (cadence-step tasks are excluded).
     * GET /v2/tasks
     * https://developers.salesloft.com/docs/api/tasks-index/
     */
    async listTasks(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tasks,
            query: params,
        });
    }

    /**
     * Fetch a task by id.
     * GET /v2/tasks/{id}
     * https://developers.salesloft.com/docs/api/tasks/
     */
    async getTask(id) {
        return this._get({
            url: this.baseUrl + this.URLs.taskById(id),
        });
    }

    /**
     * Create a task.
     * POST /v2/tasks
     * https://developers.salesloft.com/docs/api/tasks-create/
     */
    async createTask(task) {
        return this._post({
            url: this.baseUrl + this.URLs.tasks,
            headers: { 'Content-Type': 'application/json' },
            body: task,
        });
    }

    /**
     * Update a task.
     * PUT /v2/tasks/{id}
     * https://developers.salesloft.com/docs/api/tasks-update/
     */
    async updateTask(id, task) {
        return this._put({
            url: this.baseUrl + this.URLs.taskById(id),
            headers: { 'Content-Type': 'application/json' },
            body: task,
        });
    }

    /**
     * Delete a task.
     * DELETE /v2/tasks/{id}
     * https://developers.salesloft.com/docs/api/tasks-destroy/
     */
    async deleteTask(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.taskById(id),
        });
    }

    // ---- Webhook subscriptions --------------------------------------------

    /**
     * List webhook subscriptions.
     * GET /v2/webhook_subscriptions
     * https://developers.salesloft.com/docs/api/webhook-subscriptions-index/
     */
    async listWebhookSubscriptions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            query: params,
        });
    }

    /**
     * Fetch a webhook subscription by id.
     * GET /v2/webhook_subscriptions/{id}
     * https://developers.salesloft.com/docs/api/webhook-subscriptions-show/
     */
    async getWebhookSubscription(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    /**
     * Create a webhook subscription.
     * POST /v2/webhook_subscriptions
     * Body: { event_type, callback_url, callback_token }
     * https://developers.salesloft.com/docs/api/webhook-subscriptions-create/
     */
    async createWebhookSubscription(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a webhook subscription (e.g. enabled, callback_url).
     * PUT /v2/webhook_subscriptions/{id}
     * https://developers.salesloft.com/docs/api/webhook-subscriptions-update/
     */
    async updateWebhookSubscription(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a webhook subscription.
     * DELETE /v2/webhook_subscriptions/{id}
     * https://developers.salesloft.com/docs/api/webhook-subscriptions-destroy/
     */
    async deleteWebhookSubscription(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    // ---- Webhook signature verification -----------------------------------

    /**
     * Verify a Salesloft webhook delivery signature.
     *
     * Per https://developers.salesloft.com/docs/platform/webhooks/delivery-headers/:
     *   x-salesloft-signature = HMAC-SHA1 hex digest of the response body,
     *   keyed with the subscription's callback_token.
     *
     * @param {Object} args
     * @param {string|Buffer} args.body - Raw request body bytes/string.
     * @param {string} args.signature - Value of x-salesloft-signature.
     * @param {string} args.callbackToken - Shared secret from createWebhookSubscription.
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({ body, signature, callbackToken }) {
        if (!callbackToken || typeof callbackToken !== 'string') {
            return { valid: false, reason: 'missing callback token' };
        }
        if (!signature || typeof signature !== 'string') {
            return { valid: false, reason: 'missing x-salesloft-signature' };
        }
        const raw =
            typeof body === 'string'
                ? body
                : Buffer.isBuffer(body)
                  ? body.toString('utf8')
                  : body == null
                    ? ''
                    : JSON.stringify(body);
        const expected = crypto
            .createHmac('sha1', callbackToken)
            .update(raw, 'utf8')
            .digest('hex');
        try {
            const a = Buffer.from(expected, 'utf8');
            const b = Buffer.from(signature, 'utf8');
            if (a.length !== b.length) {
                return { valid: false, reason: 'signature mismatch' };
            }
            if (!crypto.timingSafeEqual(a, b)) {
                return { valid: false, reason: 'signature mismatch' };
            }
            return { valid: true };
        } catch (_err) {
            return { valid: false, reason: 'signature mismatch' };
        }
    }
}

module.exports = { Api };
