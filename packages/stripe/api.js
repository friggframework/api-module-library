const { OAuth2Requester, get } = require('@friggframework/core');
const Stripe = require('stripe');

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

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
}

module.exports = { Api };
