const { OAuth2Requester, get } = require('@friggframework/core');
const Stripe = require('stripe');

const crypto = require('crypto');

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes the vendor signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function whNowMs(now) {
    if (now instanceof Date) return now.getTime();
    return typeof now === 'number' ? now : Date.now();
}

function whHmac(key, parts, encoding) {
    const h = crypto.createHmac('sha256', key);
    for (const p of parts) h.update(p);
    return h.digest(encoding);
}

function errorMessage(e) {
    return e instanceof Error ? e.message : JSON.stringify(e);
}

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);
        this.webhookSecret = (params && params.webhookSecret) || null;

        this.stripeApiSecretKey = get(params, 'stripeApiSecretKey');
        this.stripeClientId = get(params, 'stripeClientId');
        this.redirect_uri = get(params, 'redirect_uri');
        this.stripeAccountId = get(params, 'stripeAccountId', null);

        this.stripe = new Stripe(this.stripeApiSecretKey);

        this.authorizationUri = this.getAuthUri();
    }

    setStripeAccountId(stripeAccountId) {
        this.stripeAccountId = stripeAccountId;
    }

    getAuthUri() {
        return this.stripe.oauth.authorizeUrl({
            response_type: 'code',
            client_id: this.stripeClientId,
            redirect_uri: this.redirect_uri,
            scope: 'read_write',
            state: null,
        });
    }

    async getTokenFromCode(code) {
        const tokens = await this.stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code,
        });

        await this.setTokens(tokens);
        if (tokens.stripe_user_id) {
            this.setStripeAccountId(tokens.stripe_user_id);
        }

        return tokens;
    }

    async refreshAccessToken(refreshToken, retries = 0) {
        refreshToken =
            typeof refreshToken === 'string'
                ? refreshToken
                : refreshToken.refresh_token;

        console.log('refreshAccessToken', refreshToken, retries);

        //check if refreshToken is not a String, wierd value has been bubbled up from inheritence of { refresh_token: null }
        if (typeof refreshToken !== 'string')
            throw new Error(
                `refreshAccessToken: refreshToken must be a string. has passed in ${refreshToken} (${typeof refreshToken})`,
            );
        if (!refreshToken)
            throw new Error('No refreshToken passed to refreshAccessToken().');

        try {
            if (retries < 3) {
                retries++;
                return await this.stripe.oauth.token({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                });
            } else {
                throw new Error(
                    '3 unsuccessful attempts to refresh Stripe auth.',
                );
            }
        } catch (e) {
            if (e.statusCode) {
                console.log(`Retries: ${retries},   Message: ${e.message}`);
                if (e.statusCode > 299) {
                    return await this.refreshAccessToken(
                        refreshToken,
                        ++retries,
                    );
                }
                console.log('Refresh token error:', e.message);
            }
            throw e;
        }
    }

    async listAccounts() {
        try {
            return await this.stripe.accounts.list();
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('List accounts error:', error);
            throw e;
        }
    }

    async getAccountDetails(id, params = {}) {
        let accountId = id || this.stripeAccountId;
        if (!accountId) {
            const accounts = await this.listAccounts();
            if (accounts.data.length > 0) accountId = accounts.data[0].id;
        }

        if (!accountId) throw new Error('Unable to get accountId');

        try {
            return await this.stripe.accounts.retrieve(accountId, params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Get Account details error:', error);
            throw e;
        }
    }

    async getBalanceTransactions(params) {
        try {
            return await this.stripe.balanceTransactions.list(params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Get balance transactions error:', error);
            throw e;
        }
    }

    async listAllCharges(params) {
        try {
            return await this.stripe.charges.list(params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Get charges info error:', error);
            throw e;
        }
    }

    async createWebhook(url, enabledEvents) {
        try {
            return await this.stripe.webhookEndpoints.create({
                url: url,
                enabled_events: enabledEvents,
            });
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Create webhook error:', error);
            throw e;
        }
    }

    async deleteWebhook(id, params) {
        try {
            return await this.stripe.webhookEndpoints.del(id, params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Delete webhook error:', error);
            throw e;
        }
    }

    // ---- customers, payment intents, refunds, payouts ----------------------
    // Each call is a thin wrapper over the official stripe-node resource. `options` is the
    // stripe-node RequestOptions object (e.g. { idempotencyKey, stripeAccount }).

    /** GET /v1/customers/:id. https://docs.stripe.com/api/customers/retrieve */
    async retrieveCustomer(id, params = {}, options = {}) {
        if (!id) throw new Error('retrieveCustomer: id is required');
        try {
            return await this.stripe.customers.retrieve(id, params, options);
        } catch (e) {
            console.log('Retrieve customer error:', errorMessage(e));
            throw e;
        }
    }

    /**
     * GET /v1/customers. https://docs.stripe.com/api/customers/list
     * `params` are Stripe's list params (limit, starting_after, ending_before, email, created, ...).
     * Shorthand: `created_gte` (unix seconds) is sent as `created[gte]`.
     */
    async listCustomers(params = {}, options = {}) {
        try {
            const { created_gte, ...rest } = params || {};
            const query = { ...rest };
            if (created_gte !== undefined && created_gte !== null) {
                query.created = { ...(rest.created || {}), gte: created_gte };
            }
            return await this.stripe.customers.list(query, options);
        } catch (e) {
            console.log('List customers error:', errorMessage(e));
            throw e;
        }
    }

    /**
     * GET /v1/customers/search. https://docs.stripe.com/api/customers/search
     * `query` is Stripe's search query language, e.g. "email:'a@b.com'". `params` may carry limit and page.
     */
    async searchCustomers(query, params = {}, options = {}) {
        if (!query) throw new Error('searchCustomers: query is required');
        try {
            return await this.stripe.customers.search({ ...params, query }, options);
        } catch (e) {
            console.log('Search customers error:', errorMessage(e));
            throw e;
        }
    }

    /** POST /v1/customers. https://docs.stripe.com/api/customers/create */
    async createCustomer(params = {}, options = {}) {
        try {
            return await this.stripe.customers.create(params, options);
        } catch (e) {
            console.log('Create customer error:', errorMessage(e));
            throw e;
        }
    }

    /** POST /v1/customers/:id. https://docs.stripe.com/api/customers/update */
    async updateCustomer(id, params = {}, options = {}) {
        if (!id) throw new Error('updateCustomer: id is required');
        try {
            return await this.stripe.customers.update(id, params, options);
        } catch (e) {
            console.log('Update customer error:', errorMessage(e));
            throw e;
        }
    }

    /**
     * GET /v1/payment_intents/:id. https://docs.stripe.com/api/payment_intents/retrieve
     * `params` is `{ expand: [...] }`; an array is taken as the expand list.
     */
    async retrievePaymentIntent(id, params = {}, options = {}) {
        if (!id) throw new Error('retrievePaymentIntent: id is required');
        try {
            const query = Array.isArray(params) ? { expand: params } : params;
            return await this.stripe.paymentIntents.retrieve(id, query, options);
        } catch (e) {
            console.log('Retrieve payment intent error:', errorMessage(e));
            throw e;
        }
    }

    /** GET /v1/refunds/:id. https://docs.stripe.com/api/refunds/retrieve */
    async retrieveRefund(id, params = {}, options = {}) {
        if (!id) throw new Error('retrieveRefund: id is required');
        try {
            return await this.stripe.refunds.retrieve(id, params, options);
        } catch (e) {
            console.log('Retrieve refund error:', errorMessage(e));
            throw e;
        }
    }

    /**
     * GET /v1/payouts. https://docs.stripe.com/api/payouts/list
     * `params` are Stripe's list params (status, limit, starting_after, arrival_date, created, ...).
     * Shorthand: `arrivedAfter` / `arrivedBefore` (unix seconds or a date string) are sent as
     * `arrival_date[gt]` / `arrival_date[lt]`.
     */
    async listPayouts(params = {}, options = {}) {
        try {
            const { arrivedAfter, arrivedBefore, ...rest } = params || {};
            const query = { ...rest };
            const arrival = { ...(rest.arrival_date || {}) };
            const ts = (v) =>
                typeof v === 'number' ? v : Math.floor(new Date(v).getTime() / 1000);
            if (arrivedAfter !== undefined && arrivedAfter !== null) arrival.gt = ts(arrivedAfter);
            if (arrivedBefore !== undefined && arrivedBefore !== null) arrival.lt = ts(arrivedBefore);
            if (Object.keys(arrival).length) query.arrival_date = arrival;
            return await this.stripe.payouts.list(query, options);
        } catch (e) {
            console.log('List payouts error:', errorMessage(e));
            throw e;
        }
    }

    /**
     * Verify a Stripe webhook delivery (Stripe-Signature).
     * Docs: https://docs.stripe.com/webhooks#verify-manually
     *
     * Header `t=<ts>,v1=<sig>[,v1=<sig2>]`; each v1 is hex HMAC-SHA256 of `${t}.${raw body}` keyed with
     * the endpoint's whsec_ secret (several when a secret is being rolled: pass an array as
     * `webhookSecret`). Other schemes (v0) are ignored. Default tolerance is 300s (`tolerance` overrides;
     * 0 is not accepted because Stripe says it disables the check). Pass `rawBody`.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, now, tolerance } = {}) {
        try {
            const configured =
                this.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
            const secrets = (Array.isArray(configured) ? configured : [configured]).filter(
                Boolean
            );
            if (!secrets.length) return false;
            const header = whHeader(headers, 'stripe-signature');
            if (!header) return false;
            let timestamp = null;
            const sigs = [];
            for (const item of String(header).split(',')) {
                const i = item.indexOf('=');
                if (i < 0) continue;
                const k = item.slice(0, i).trim();
                const v = item.slice(i + 1).trim();
                if (k === 't') timestamp = v;
                else if (k === 'v1') sigs.push(v);
            }
            if (!timestamp || !sigs.length) return false;
            const ts = Number(timestamp);
            if (!Number.isFinite(ts)) return false;
            const tol = Number(tolerance) > 0 ? Number(tolerance) : 300;
            if (Math.abs(whNowMs(now) / 1000 - ts) > tol) return false;
            const payload = whPayload(rawBody, body);
            let ok = false;
            for (const secret of secrets) {
                const expected = whHmac(secret, [`${timestamp}.`, payload], 'hex');
                for (const sig of sigs) {
                    if (whSafeEqual(expected, sig)) ok = true;
                }
            }
            return ok;
        } catch (e) {
            return false;
        }
    }
}

module.exports = { Api };
