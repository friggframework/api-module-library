import { OAuth2Requester, get } from '@friggframework/core';
import Stripe from 'stripe';

export class Api extends OAuth2Requester {
    private readonly stripe: Stripe;
    private readonly stripeApiSecretKey: string;
    private readonly stripeClientId: string;
    private stripeUserId: string;
    readonly redirect_uri: string;

    constructor(params = {}) {
        super(params);

        this.stripeApiSecretKey = get(params, 'stripeApiSecretKey');
        this.stripeClientId = get(params, 'stripeClientId');
        this.stripeUserId = get(params, 'stripe_user_id');
        this.redirect_uri = get(params, 'redirect_uri');

        this.stripe = new Stripe(this.stripeApiSecretKey);
    }

    setStripeUserId(stripeUserId: string) {
        this.stripeUserId = stripeUserId;
    }

    getAuthUri() {
        return this.stripe.oauth.authorizeUrl({
            response_type: 'code',
            client_id: this.stripeClientId,
            redirect_uri: this.redirect_uri,
            scope: 'read_write',
            state: JSON.stringify({ app: 'stripe' }),
        });
    }

    getTokenFromCode(code: string) {
        return this.stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code,
        });
    }

    async refreshAccessToken(
        refreshToken: string | { refresh_token: string },
        retries: number = 0,
    ): Promise<Stripe.OAuthToken> {
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

    async getAccountDetails(
        params: Stripe.AccountRetrieveParams = {},
    ): Promise<Stripe.Response<Stripe.Account>> {
        try {
            return await this.stripe.accounts.retrieve(
                this.stripeUserId,
                params,
            );
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Get Account details error:', error);
            throw e;
        }
    }

    async getBalanceTransactions(
        params: Stripe.BalanceTransactionListParams,
    ): Promise<Stripe.Response<Stripe.ApiList<Stripe.BalanceTransaction>>> {
        try {
            return await this.stripe.balanceTransactions.list(params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Get balance transactions error:', error);
            throw e;
        }
    }

    async listAllCharges(
        params: Stripe.ChargeListParams,
    ): Promise<Stripe.ApiList<Stripe.Charge>> {
        try {
            return await this.stripe.charges.list(params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Get charges info error:', error);
            throw e;
        }
    }

    async createWebhook(
        url: string,
        enabledEvents: Stripe.WebhookEndpointCreateParams['enabled_events'],
    ): Promise<Stripe.Response<Stripe.WebhookEndpoint>> {
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

    async deleteWebhook(
        id: string,
        params?: Stripe.WebhookEndpointDeleteParams,
    ): Promise<Stripe.Response<Stripe.DeletedWebhookEndpoint>> {
        try {
            return await this.stripe.webhookEndpoints.del(id, params);
        } catch (e) {
            const error = e instanceof Error ? e.message : JSON.stringify(e);
            console.log('Delete webhook error:', error);
            throw e;
        }
    }
}
