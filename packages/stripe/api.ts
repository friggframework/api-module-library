const crypto = require('crypto');
const { OAuth2Requester } = require('@friggframework/module-plugin');
import Stripe from 'stripe';

import {
    BalanceTransactionTypes,
    IBalanceTransaction,
    IStripeCharge,
    IStripeDateParameter,
    IStripeResponse,
} from './interfaces/interfaces';

export class Api extends OAuth2Requester {
    private readonly stripe: Stripe;
    private readonly useMockData: boolean;

    constructor(params: any = {}) {
        super(params);

        this.stripe = new Stripe(process.env.STRIPE_API_SECRET_KEY as string, {
            apiVersion: '2022-11-15',
        });
        this.useMockData = false;

        this.stripe_user_id = params.stripe_user_id;
        this.baseUrl = `https://api.stripe.com`;

        this.URLs = {
            account: (accountId: string) => `/v1/accounts/${accountId}`,
            authorize: '/oauth/authorize',
            balanceTransactions: '/v1/balance_transactions',
            charges: '/v1/charges',
            token: '/oauth/token',
            webhook: '/v1/webhook_endpoints',
        };
    }

    setAccessToken(access_token: string) {
        this.access_token = access_token;
    }

    setRefreshToken(refresh_token: string) {
        this.refresh_token = refresh_token;
    }

    setStripeUserId(stripeUserId: string) {
        this.stripe_user_id = stripeUserId;
    }

    async getAuthUri() {
        const baseUrl = 'https://connect.stripe.com/oauth/authorize';
        const params = new URLSearchParams({
            client_id: process.env.STRIPE_CLIENT_ID as string,
            scope: 'read_write',
            redirect_uri: process.env.REDIRECT_URI as string,
            response_type: 'code',
            state: JSON.stringify({ app: 'stripe' }),
        });
        return `${baseUrl}?${params.toString()}`;
    }

    async getAuthorizationCode() {
        let params = {
            client_id: process.env.STRIPE_CLIENT_ID,
            response_type: 'code',
            redirect_uri: process.env.REDIRECT_URI,
            scope: 'read_write',
        };

        let res = await this.postBearless(this.URLs.authorize, params);
        return res;
    }

    async getTokenFromCode(code: string) {
        let body = {
            grant_type: 'authorization_code',
            code: code,
        };
        return this.stripe.oauth.token(body as any);
    }

    async refreshAccessToken(
        refreshToken: string | { refresh_token: string },
        retries: number = 0,
    ): Promise<any> {
        refreshToken =
            typeof refreshToken === 'string'
                ? refreshToken
                : refreshToken.refresh_token;

        console.log('refreshAccessToken', refreshToken, retries);

        //check if refreshToken is not a String, wierd value has been bubbled up from inheritence of { refresh_token: null }
        if (typeof refreshToken !== 'string')
            throw new Error(
                'refreshAccessToken: refreshToken must be a string. has passed in ',
                refreshToken,
            );
        if (!refreshToken)
            throw new Error('No refreshToken passed to refreshAccessToken().');

        try {
            if (retries < 3) {
                retries++;
                let body = {
                    grant_type: 'refresh_token',
                    client_id: process.env.STRIPE_CLIENT_ID,
                    client_secret: process.env.STRIPE_API_KEY,
                    refresh_token: refreshToken,
                    redirect_uri: process.env.REDIRECT_URI,
                };
                return await this.postBearless(this.URLs.token, body);
            } else {
                throw new Error(
                    '3 unsuccessful attempts to refresh Strip auth.',
                );
            }
        } catch (e: any) {
            if (e.statusCode) {
                console.log(`Retries: ${retries},   Message: ${e.message}`);
                if (e.statusCode > 299) {
                    retries++;
                    // return await this.refreshAccessToken(refreshToken, retries);
                }
                console.log('Refresh token error:', e.message);
                throw e;
            }
        }
    }

    async getAccountDetails(query: object = {}) {
        try {
            let res = await this._get(
                this.URLs.account(this.stripe_user_id),
                query,
            );
            return res;
        } catch (e: any) {
            console.log('Get Account details error:', e.message);
        }
    }

    async getBalanceTransactions(query: {
        payout?: string;
        type?: BalanceTransactionTypes;
        created?: IStripeDateParameter;
        currency?: string;
        ending_before?: string;
        limit?: string;
        source?: string;
        starting_after?: string;
    }): Promise<IStripeResponse<IBalanceTransaction[]>> {
        const createdParameters: Record<string, string | number> = {};

        if (query.created?.gt) {
            createdParameters['created[gt]'] =
                new Date(query.created.gt).getTime() * 0.001;
        }

        if (query.created?.gte) {
            createdParameters['created[gte]'] =
                new Date(query.created.gte).getTime() * 0.001;
        }

        if (query.created?.lt) {
            createdParameters['created[lt]'] =
                new Date(query.created.lt).getTime() * 0.001;
        }

        if (query.created?.lte) {
            createdParameters['created[lte]'] =
                new Date(query.created.lte).getTime() * 0.001;
        }

        if (query.starting_after) {
            createdParameters['starting_after'] = query.starting_after;
        }

        delete query.starting_after;

        const { created: _, ...normalizedQuery } = {
            ...query,
            ...createdParameters,
        };

        return this._get(this.URLs.balanceTransactions, normalizedQuery).catch(
            (error) => {
                console.log('Get Balance transactions error:', error.message);
                throw error;
            },
        );
    }

    async listAllCharges(query: object): Promise<IStripeCharge[] | undefined> {
        if (this.useMockData) {
            const mockData = require('./mocks/getCharges_response.json');
            return mockData.data as IStripeCharge[];
        }

        try {
            let res = await this._get(this.URLs.charges, query);
            return res.data as IStripeCharge[];
        } catch (e: any) {
            console.log('Get charges info error:', e.message);
        }
    }

    async createWebhook(url: string) {
        let body = {
            url: url,
            enabled_events: [
                'charge.updated',
                'charge.succeeded',
                'charge.refunded',
                'charge.refund.updated',
            ],
        };
        let webhook = await this._post(this.URLs.webhook, body);

        return webhook;
    }

    async deleteWebhook(params: any) {
        let res = await this.stripe.webhookEndpoints.del(params);
        return res;
    }

    private async _get(url: string, query: object) {
        try {
            let options = {
                method: 'GET',
                uri: `${this.baseUrl}${url}`,
                query,
                headers: {
                    Authorization: `bearer ${this.access_token}`,
                    'Stripe-Account': this.stripe_user_id,
                },
                json: true,
            };
            let res = await this._request(options.uri, options);
            console.log({ getData: options });
            return res;
        } catch (e: any) {
            console.log(`GET ${url} error: ${e.message}`);
            throw new Error(e.message);
        }
    }

    private async _post(url: string, body: object) {
        try {
            let options = {
                method: 'POST',
                uri: `${this.baseUrl}${url}`,
                form: body,
                headers: {
                    Authorization: `bearer ${this.accessToken}`,
                    'Stripe-Account': this.stripe_user_id,
                },
            };

            let res = await this._request(options.uri, options);
            return res;
        } catch (e: any) {
            console.log(`POST ${url} error: ${e.message}`);
            throw new Error(e.message);
        }
    }

    private async postBearless(apiUrlEnding: string, data: any) {
        try {
            let basicString = process.env.STRIPE_API_SECRET_KEY + ':';
            let authHeader = await Buffer.from(basicString).toString('base64');
            let options = {
                method: 'POST',
                uri: 'https://connect.stripe.com' + apiUrlEnding,
                headers: {
                    // 'Stripe-Account': this.stripe_user_id,
                    Authorization: `Basic ${authHeader}`,
                },
                form: data,
            };

            return await this._request(options.uri, options);
        } catch (e: any) {
            console.log(`POST${apiUrlEnding} error: ${e.message}`);
            throw new Error(e.message);
        }
    }
}
