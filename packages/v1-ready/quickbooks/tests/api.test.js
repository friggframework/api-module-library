const crypto = require('crypto');
const { Api, PRODUCTION_BASE_URL, DEFAULT_MINOR_VERSION } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        refresh_token: 'ref',
        realmId: '9130354628571476',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/quickbooks',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { QueryResponse: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    return api;
}

describe('QuickBooks Api', () => {
    describe('construction & auth', () => {
        it('defaults to the production base URL and minorversion 75', () => {
            const api = new Api({
                access_token: 'a',
                refresh_token: 'r',
                realmId: '1',
            });
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.minorversion).toBe(DEFAULT_MINOR_VERSION);
            expect(api.minorversion).toBeGreaterThanOrEqual(75);
        });

        it('uses the sandbox host when environment=sandbox', () => {
            const api = new Api({
                environment: 'sandbox',
                access_token: 'a',
                refresh_token: 'r',
                realmId: '1',
            });
            expect(api.baseUrl).toBe(
                'https://sandbox-quickbooks.api.intuit.com'
            );
        });

        it('builds the Intuit authorize URL with accounting scope', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/quickbooks',
                scope: 'com.intuit.quickbooks.accounting',
                state: 'st',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                'https://appcenter.intuit.com/connect/oauth2?'
            );
            expect(url).toContain('client_id=cid');
            expect(url).toContain('response_type=code');
            expect(url).toContain(
                'scope=com.intuit.quickbooks.accounting'
            );
        });

        it('exchanges codes via Basic auth (Intuit token endpoint)', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app.example/redirect/quickbooks',
            });
            const spy = jest
                .spyOn(api, 'getTokenFromCodeBasicAuthHeader')
                .mockResolvedValue({ access_token: 'a' });
            await api.getTokenFromCode('the-code');
            expect(spy).toHaveBeenCalledWith('the-code');
        });

        it('refreshAccessToken uses Basic auth and form body', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                refresh_token: 'old-refresh',
            });
            api._post = async (options) => {
                api._lastRefresh = options;
                return {
                    access_token: 'new-a',
                    refresh_token: 'new-r',
                    expires_in: 3600,
                    x_refresh_token_expires_in: 8640000,
                };
            };
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'old-refresh' });
            expect(api._lastRefresh.headers.Authorization).toMatch(/^Basic /);
            expect(api._lastRefresh.body.get('grant_type')).toBe(
                'refresh_token'
            );
            expect(api._lastRefresh.body.get('refresh_token')).toBe(
                'old-refresh'
            );
        });
    });

    describe('company & query', () => {
        it('getCompanyInfo hits companyinfo with realmId twice and minorversion', async () => {
            const api = makeApi();
            await api.getCompanyInfo();
            const { url, query } = api._captured[0];
            expect(url).toBe(
                `${PRODUCTION_BASE_URL}/v3/company/9130354628571476/companyinfo/9130354628571476`
            );
            expect(query.minorversion).toBe(75);
        });

        it('query sends the SQL as the query param', async () => {
            const api = makeApi();
            await api.query('SELECT * FROM Customer');
            expect(api._captured[0].url).toContain('/query');
            expect(api._captured[0].query.query).toBe(
                'SELECT * FROM Customer'
            );
        });

        it('requires realmId before calling the Accounting API', async () => {
            const api = makeApi({ realmId: null });
            await expect(api.getCompanyInfo()).rejects.toThrow(/realmId/);
        });
    });

    describe('customers', () => {
        it('getCustomer GETs /customer/{id}', async () => {
            const api = makeApi();
            await api.getCustomer('58');
            expect(api._captured[0].url).toContain('/customer/58');
        });

        it('queryCustomers wraps a WHERE clause', async () => {
            const api = makeApi();
            await api.queryCustomers({
                where: "PrimaryEmailAddr = 'a@b.com'",
            });
            expect(api._captured[0].query.query).toBe(
                "SELECT * FROM Customer WHERE PrimaryEmailAddr = 'a@b.com'"
            );
        });

        it('listCustomers builds STARTPOSITION/MAXRESULTS and optional changedSince', async () => {
            const api = makeApi();
            await api.listCustomers({
                changedSince: '2026-01-01T00:00:00Z',
                startPosition: 5,
                maxResults: 50,
            });
            const sql = api._captured[0].query.query;
            expect(sql).toContain(
                "MetaData.LastUpdatedTime > '2026-01-01T00:00:00Z'"
            );
            expect(sql).toContain('STARTPOSITION 5');
            expect(sql).toContain('MAXRESULTS 50');
        });

        it('createCustomer POSTs the entity body', async () => {
            const api = makeApi();
            await api.createCustomer({ DisplayName: 'Ada' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain('/customer');
            expect(api._captured[0].body).toEqual({ DisplayName: 'Ada' });
            expect(api._captured[0].url).not.toContain('sparse');
        });

        it('updateCustomer POSTs with sparse=true and requires SyncToken', async () => {
            const api = makeApi();
            await api.updateCustomer({
                Id: '1',
                SyncToken: '0',
                DisplayName: 'Ada',
            });
            expect(api._captured[0].query.sparse).toBe(true);
            await expect(
                api.updateCustomer({ Id: '1', DisplayName: 'x' })
            ).rejects.toThrow(/SyncToken/);
        });
    });

    describe('invoices, payments, receipts, deposits', () => {
        it('createInvoice / getInvoice / sendInvoice hit documented paths', async () => {
            const api = makeApi();
            await api.createInvoice({ CustomerRef: { value: '1' } });
            expect(api._captured[0].url).toContain('/invoice');
            await api.getInvoice('9');
            expect(api._captured[1].url).toContain('/invoice/9');
            await api.sendInvoice('9', 'billing@acme.com');
            expect(api._captured[2].url).toContain('/invoice/9/send');
            expect(api._captured[2].query.sendTo).toBe('billing@acme.com');
        });

        it('getPayment / createSalesReceipt / createRefundReceipt / createDeposit', async () => {
            const api = makeApi();
            await api.getPayment('1871');
            expect(api._captured[0].url).toContain('/payment/1871');
            await api.createSalesReceipt({ TotalAmt: 10 });
            expect(api._captured[1].url).toContain('/salesreceipt');
            await api.createRefundReceipt({ TotalAmt: 5 });
            expect(api._captured[2].url).toContain('/refundreceipt');
            await api.createDeposit({ DepositToAccountRef: { value: '1' } });
            expect(api._captured[3].url).toContain('/deposit');
        });
    });

    describe('option lists', () => {
        it('listItems and listAccounts query with optional type filters', async () => {
            const api = makeApi();
            await api.listItems({ type: 'Service' });
            expect(api._captured[0].query.query).toContain(
                "Type = 'Service'"
            );
            await api.listAccounts({ accountType: 'Bank' });
            expect(api._captured[1].query.query).toContain(
                "AccountType = 'Bank'"
            );
        });
    });

    describe('verifyWebhookSignature', () => {
        const verifier = 'test-verifier-token';

        const sign = (body) =>
            crypto
                .createHmac('sha256', verifier)
                .update(body, 'utf8')
                .digest('base64');

        it('accepts a valid intuit-signature over the raw body', async () => {
            const api = new Api({ webhookVerifierToken: verifier });
            const rawBody = JSON.stringify({
                eventNotifications: [{ realmId: '1' }],
            });
            const ok = await api.verifyWebhookSignature({
                headers: { 'intuit-signature': sign(rawBody) },
                rawBody,
            });
            expect(ok).toBe(true);
        });

        it('rejects a bad signature and missing secret without throwing', async () => {
            const api = new Api({ webhookVerifierToken: verifier });
            expect(
                await api.verifyWebhookSignature({
                    headers: { 'intuit-signature': 'nope' },
                    rawBody: '{}',
                })
            ).toBe(false);
            const bare = new Api({});
            expect(
                await bare.verifyWebhookSignature({
                    headers: { 'intuit-signature': 'x' },
                    rawBody: '{}',
                })
            ).toBe(false);
        });
    });
});
