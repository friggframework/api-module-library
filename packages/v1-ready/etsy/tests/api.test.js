const crypto = require('crypto');
const { Api, STATE_VERIFIER_DELIMITER } = require('../api');
const { verifyEtsyWebhook } = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'keystring',
        client_secret: 'sharedsecret',
        redirect_uri: 'https://app.example/redirect/etsy',
        scope: 'shops_r listings_r',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [], count: 0 };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { listing_id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { shop_id: 1 };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { listing_id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Etsy Api', () => {
    describe('construction & auth', () => {
        it('sets the Open API v3 base URL and OAuth endpoints', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/etsy',
            });
            expect(api.baseUrl).toBe('https://api.etsy.com/v3/application');
            expect(api.tokenUri).toBe(
                'https://api.etsy.com/v3/public/oauth/token'
            );
            expect(api.authorizationUriBase).toBe(
                'https://www.etsy.com/oauth/connect'
            );
        });

        it('adds x-api-key as keystring:shared_secret and Bearer token', async () => {
            const api = new Api({
                access_token: 'tok',
                client_id: 'ks',
                client_secret: 'ss',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers['x-api-key']).toBe('ks:ss');
            expect(headers.Authorization).toBe('Bearer tok');
        });

        it('falls back to keystring-only x-api-key when secret missing', async () => {
            const api = new Api({
                access_token: 'tok',
                client_id: 'ks',
                client_secret: null,
            });
            api.client_secret = null;
            const headers = await api.addAuthHeaders({});
            expect(headers['x-api-key']).toBe('ks');
        });

        it('reports authenticated only with an access token', () => {
            expect(new Api({ access_token: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('PKCE OAuth', () => {
        it('getAuthorizationUri includes PKCE and sealed state', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'super-secret-value',
                redirect_uri: 'https://app.example/redirect/etsy',
                scope: 'shops_r transactions_r',
            });
            const url = api.getAuthorizationUri({ state: 'caller' });
            expect(url).toContain('https://www.etsy.com/oauth/connect?');
            expect(url).toContain('response_type=code');
            expect(url).toContain('client_id=cid');
            expect(url).toContain('code_challenge_method=S256');
            expect(url).toContain('code_challenge=');
            expect(url).toContain('scope=shops_r');
            const state = new URL(url).searchParams.get('state');
            expect(state).toContain(`caller${STATE_VERIFIER_DELIMITER}`);
            const verifier = api.restoreVerifierFromState(state);
            expect(verifier.length).toBeGreaterThanOrEqual(43);
        });

        it('getTokenFromCodeWithPKCE posts the official token body', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.getTokenFromCodeWithPKCE('auth-code', 'verifier-value');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.etsy.com/v3/public/oauth/token'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('client_id=keystring');
            expect(body).toContain('code=auth-code');
            expect(body).toContain('code_verifier=verifier-value');
            expect(body).not.toContain('client_secret');
        });

        it('refreshAccessToken posts grant_type=refresh_token', async () => {
            const api = makeApi({ refresh_token: 'r1' });
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'r1' });
            const body = api._captured[0].body.toString();
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain('refresh_token=r1');
            expect(body).toContain('client_id=keystring');
        });
    });

    describe('identity & shops', () => {
        it('ping / getMe / getShop hit the documented paths', async () => {
            const api = makeApi();
            await api.ping();
            expect(api._captured[0].url).toBe(
                'https://api.etsy.com/v3/application/openapi-ping'
            );
            await api.getMe();
            expect(api._captured[1].url).toBe(
                'https://api.etsy.com/v3/application/users/me'
            );
            await api.getShop(123);
            expect(api._captured[2].url).toBe(
                'https://api.etsy.com/v3/application/shops/123'
            );
        });

        it('findShops and getShopByOwnerUserId', async () => {
            const api = makeApi();
            await api.findShops({ shop_name: 'Acme', limit: 10 });
            expect(api._captured[0].url).toContain('/shops?');
            expect(api._captured[0].url).toContain('shop_name=Acme');
            await api.getShopByOwnerUserId(99);
            expect(api._captured[1].url).toBe(
                'https://api.etsy.com/v3/application/users/99/shops'
            );
        });
    });

    describe('listings', () => {
        it('list / get / create / update / delete', async () => {
            const api = makeApi();
            await api.getListingsByShop(1, { state: 'active', limit: 5 });
            expect(api._captured[0].url).toContain(
                '/shops/1/listings?state=active'
            );
            await api.getListing(42);
            expect(api._captured[1].url).toBe(
                'https://api.etsy.com/v3/application/listings/42'
            );
            await api.createDraftListing(1, {
                quantity: 1,
                title: 'Mug',
                description: 'Handmade',
                price: 12.5,
                who_made: 'i_did',
                when_made: '2020_2026',
                taxonomy_id: 1,
            });
            expect(api._captured[2]).toMatchObject({
                method: 'POST',
                url: 'https://api.etsy.com/v3/application/shops/1/listings',
            });
            expect(api._captured[2].body.toString()).toContain('title=Mug');
            await api.updateListing(1, 42, { title: 'Mug 2' });
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[3].url).toBe(
                'https://api.etsy.com/v3/application/shops/1/listings/42'
            );
            await api.deleteListing(42);
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('receipts / transactions / payments', () => {
        it('receipts and payments paths', async () => {
            const api = makeApi();
            await api.getShopReceipts(1, { was_paid: true, limit: 25 });
            expect(api._captured[0].url).toContain('/shops/1/receipts?');
            expect(api._captured[0].url).toContain('was_paid=true');
            await api.getShopReceipt(1, 9);
            expect(api._captured[1].url).toBe(
                'https://api.etsy.com/v3/application/shops/1/receipts/9'
            );
            await api.getShopPaymentByReceiptId(1, 9);
            expect(api._captured[2].url).toBe(
                'https://api.etsy.com/v3/application/shops/1/receipts/9/payments'
            );
            await api.getShopReceiptTransactionsByShop(1);
            expect(api._captured[3].url).toBe(
                'https://api.etsy.com/v3/application/shops/1/transactions'
            );
            await api.createReceiptShipment(1, 9, {
                tracking_code: '1Z',
                carrier_name: 'usps',
            });
            expect(api._captured[4].method).toBe('POST');
            expect(api._captured[4].url).toContain('/receipts/9/tracking');
        });
    });

    describe('webhook signature', () => {
        it('accepts a valid whsec_ HMAC signature', () => {
            const rawKey = crypto.randomBytes(24);
            const secret = `whsec_${rawKey.toString('base64')}`;
            const body = JSON.stringify({
                event_type: 'order.paid',
                shop_id: '123',
                resource_url:
                    'https://api.etsy.com/v3/application/shops/123/receipts/9',
            });
            const id = 'msg_1';
            const ts = String(Math.floor(Date.now() / 1000));
            const signed = `${id}.${ts}.${body}`;
            const sig = crypto
                .createHmac('sha256', rawKey)
                .update(signed, 'utf8')
                .digest('base64');
            const result = verifyEtsyWebhook({
                req: {
                    headers: {
                        'webhook-id': id,
                        'webhook-timestamp': ts,
                        'webhook-signature': `v1,${sig}`,
                    },
                    rawBody: body,
                },
                signingSecret: secret,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a bad signature', () => {
            const result = verifyEtsyWebhook({
                req: {
                    headers: {
                        'webhook-id': 'msg_1',
                        'webhook-timestamp': String(
                            Math.floor(Date.now() / 1000)
                        ),
                        'webhook-signature': 'v1,not-valid',
                    },
                    rawBody: '{}',
                },
                signingSecret: `whsec_${Buffer.from('abc').toString('base64')}`,
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('signature_mismatch');
        });
    });
});
