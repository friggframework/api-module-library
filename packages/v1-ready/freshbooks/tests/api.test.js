const nock = require('nock');
const { Api } = require('../api');
const { TOKEN_RESPONSE, userWith, useMockedHttp } = require('./fixtures');

const createApi = (params = {}) =>
    new Api({
        client_id: 'client-id',
        client_secret: 'client-secret',
        redirect_uri: 'https://app.example.com/redirect/freshbooks',
        ...params,
    });

describe('FreshBooks Api', () => {
    useMockedHttp();

    describe('getAuthorizationUri', () => {
        it('points at the FreshBooks authorize endpoint with the client, redirect and state', () => {
            const api = createApi({ state: 'abc123' });

            const url = new URL(api.getAuthorizationUri());

            expect(`${url.origin}${url.pathname}`).toBe(
                'https://auth.freshbooks.com/oauth/authorize/'
            );
            expect(Object.fromEntries(url.searchParams)).toEqual({
                client_id: 'client-id',
                response_type: 'code',
                redirect_uri: 'https://app.example.com/redirect/freshbooks',
                state: 'abc123',
            });
        });
    });

    describe('webUrls', () => {
        it('links to clients, invoices and an invoice search in the FreshBooks web app', () => {
            const { webUrls } = createApi();

            expect(webUrls.client(7)).toBe(
                'https://my.freshbooks.com/#/client/7'
            );
            expect(webUrls.invoice('ej6eR', 11)).toBe(
                'https://my.freshbooks.com/#/invoice/ej6eR-11'
            );
            expect(webUrls.invoices()).toBe(
                'https://my.freshbooks.com/#/invoices'
            );
            expect(webUrls.invoices('Left Hook')).toBe(
                'https://my.freshbooks.com/#/invoices?q=Left%20Hook'
            );
        });
    });

    describe('invoiceStatusName', () => {
        it.each([
            [2, 'Sent'],
            [4, 'Paid'],
            [8, 'Partial'],
            [42, ''],
        ])('names invoice status %p as %p', (status, name) => {
            expect(createApi().invoiceStatusName(status)).toBe(name);
        });
    });

    describe('getTokenFromCode', () => {
        it('exchanges the code at the FreshBooks token endpoint with a JSON body', async () => {
            const scope = nock('https://api.freshbooks.com')
                .post('/auth/oauth/token', {
                    grant_type: 'authorization_code',
                    client_id: 'client-id',
                    client_secret: 'client-secret',
                    redirect_uri: 'https://app.example.com/redirect/freshbooks',
                    code: 'auth-code',
                })
                .matchHeader('content-type', 'application/json')
                .reply(200, TOKEN_RESPONSE);
            const api = createApi();

            const response = await api.getTokenFromCode('auth-code');

            expect(scope.isDone()).toBe(true);
            expect(response).toEqual(TOKEN_RESPONSE);
            expect(api.access_token).toBe('new-access');
            expect(api.refresh_token).toBe('new-refresh');
        });

        it('sends the single-use code once when FreshBooks answers 502', async () => {
            const scope = nock('https://api.freshbooks.com')
                .post('/auth/oauth/token')
                .times(4)
                .reply(502, {});
            let tokenRequests = 0;
            scope.on('request', () => tokenRequests++);

            await expect(
                createApi({ backOff: [0, 0, 0] }).getTokenFromCode('auth-code')
            ).rejects.toMatchObject({
                statusCode: 502,
            });

            expect(tokenRequests).toBe(1);
        });

        it('sends the single-use code once when FreshBooks answers 401', async () => {
            const scope = nock('https://api.freshbooks.com')
                .post('/auth/oauth/token')
                .times(4)
                .reply(401, {});
            let tokenRequests = 0;
            scope.on('request', () => tokenRequests++);

            await expect(
                createApi({ backOff: [0, 0, 0] }).getTokenFromCode('auth-code')
            ).rejects.toMatchObject({ statusCode: 401 });

            expect(tokenRequests).toBe(1);
        });
    });

    describe('refreshAccessToken', () => {
        it('replaces the single-use refresh token and notifies the delegate so it is persisted', async () => {
            const scope = nock('https://api.freshbooks.com')
                .post('/auth/oauth/token', {
                    grant_type: 'refresh_token',
                    client_id: 'client-id',
                    client_secret: 'client-secret',
                    redirect_uri: 'https://app.example.com/redirect/freshbooks',
                    refresh_token: 'old-refresh',
                })
                .reply(200, TOKEN_RESPONSE);
            const delegate = { receiveNotification: jest.fn() };
            const api = createApi({
                delegate,
                access_token: 'old-access',
                refresh_token: 'old-refresh',
            });

            await api.refreshAccessToken({ refresh_token: 'old-refresh' });

            expect(scope.isDone()).toBe(true);
            expect(api.refresh_token).toBe('new-refresh');
            expect(api.access_token).toBe('new-access');
            expect(delegate.receiveNotification).toHaveBeenCalledWith(
                api,
                api.DLGT_TOKEN_UPDATE,
                null
            );
        });

        it('sends the single-use refresh token once when FreshBooks answers 502', async () => {
            const scope = nock('https://api.freshbooks.com')
                .post('/auth/oauth/token')
                .times(4)
                .reply(502, {});
            let tokenRequests = 0;
            scope.on('request', () => tokenRequests++);
            const api = createApi({
                backOff: [0, 0, 0],
                refresh_token: 'old-refresh',
            });

            await expect(
                api.refreshAccessToken({ refresh_token: 'old-refresh' })
            ).rejects.toMatchObject({
                statusCode: 502,
            });

            expect(tokenRequests).toBe(1);
            expect(api.refresh_token).toBe('old-refresh');
        });

        it('sends the single-use refresh token once when FreshBooks answers 401', async () => {
            const scope = nock('https://api.freshbooks.com')
                .post('/auth/oauth/token')
                .times(4)
                .reply(401, {});
            let tokenRequests = 0;
            scope.on('request', () => tokenRequests++);
            const api = createApi({
                backOff: [0, 0, 0],
                refresh_token: 'old-refresh',
            });

            await expect(
                api.refreshAccessToken({ refresh_token: 'old-refresh' })
            ).rejects.toMatchObject({ statusCode: 401 });

            expect(tokenRequests).toBe(1);
        });

        describe('sends the single-use refresh token exactly once', () => {
            const tokenEndpoint = () =>
                nock('https://api.freshbooks.com').post('/auth/oauth/token');
            const notifications = (onReload = async () => null) => ({
                receiveNotification: jest.fn((_, type) =>
                    type === 'CREDENTIAL_RELOAD' ? onReload() : undefined
                ),
            });
            const refreshingApi = (delegate = notifications()) =>
                createApi({
                    delegate,
                    access_token: 'old-access',
                    refresh_token: 'old-refresh',
                    backOff: [0, 0, 0],
                    credentialReloadBackoffMs: [0],
                });
            const countRequests = (scope) => {
                let count = 0;
                scope.on('request', () => count++);
                return () => count;
            };

            it('a 502 on the refresh after a 401 is one token request and a transport failure', async () => {
                nock('https://api.freshbooks.com')
                    .get('/auth/api/v1/users/me')
                    .reply(401, {});
                const tokenRequests = countRequests(
                    tokenEndpoint().times(4).reply(502, {})
                );
                const delegate = notifications();
                const api = refreshingApi(delegate);

                await expect(api.getUserDetails()).rejects.toMatchObject({
                    isTokenRefreshTransportFailure: true,
                    statusCode: 502,
                });

                expect(tokenRequests()).toBe(1);
                expect(api.refresh_token).toBe('old-refresh');
                expect(delegate.receiveNotification).not.toHaveBeenCalledWith(
                    api,
                    api.DLGT_INVALID_AUTH,
                    expect.anything()
                );
            });

            it.each([
                [
                    'a 429',
                    (interceptor) => interceptor.times(4).reply(429, {}),
                    429,
                ],
                [
                    'a network error',
                    (interceptor) =>
                        interceptor
                            .times(4)
                            .replyWithError({ code: 'ECONNRESET' }),
                    undefined,
                ],
            ])(
                '%s is one token request and a transport failure',
                async (_, reply, statusCode) => {
                    const tokenRequests = countRequests(reply(tokenEndpoint()));
                    const delegate = notifications();
                    const api = refreshingApi(delegate);

                    const error = await api.refreshAuth().catch((e) => e);

                    expect(error.isTokenRefreshTransportFailure).toBe(true);
                    expect(error.statusCode).toBe(statusCode);
                    expect(tokenRequests()).toBe(1);
                    expect(api.refresh_token).toBe('old-refresh');
                    expect(
                        delegate.receiveNotification
                    ).not.toHaveBeenCalledWith(
                        api,
                        api.DLGT_INVALID_AUTH,
                        expect.anything()
                    );
                }
            );

            it('a 400 invalid_grant is one token request and invalidates the credential', async () => {
                const tokenRequests = countRequests(
                    tokenEndpoint()
                        .times(4)
                        .reply(400, { error: 'invalid_grant' })
                );
                const delegate = notifications();
                const api = refreshingApi(delegate);

                await expect(api.refreshAuth()).resolves.toBe(false);

                expect(tokenRequests()).toBe(1);
                expect(delegate.receiveNotification).toHaveBeenCalledWith(
                    api,
                    api.DLGT_INVALID_AUTH,
                    {
                        statusCode: 400,
                    }
                );
            });

            it('a 400 invalid_grant still adopts the newer credential another invocation stored', async () => {
                const tokenRequests = countRequests(
                    tokenEndpoint()
                        .times(4)
                        .reply(400, { error: 'invalid_grant' })
                );
                const reloads = [
                    null,
                    {
                        access_token: 'winner-access',
                        refresh_token: 'winner-refresh',
                    },
                ];
                const api = refreshingApi(
                    notifications(async () => reloads.shift())
                );

                await expect(api.refreshAuth()).resolves.toBe(true);

                expect(tokenRequests()).toBe(1);
                expect(api.access_token).toBe('winner-access');
                expect(api.refresh_token).toBe('winner-refresh');
            });

            it('a 200 sets the tokens from one token request', async () => {
                const tokenRequests = countRequests(
                    tokenEndpoint().times(2).reply(200, TOKEN_RESPONSE)
                );
                const delegate = notifications();
                const api = refreshingApi(delegate);

                await expect(api.refreshAuth()).resolves.toBe(true);

                expect(tokenRequests()).toBe(1);
                expect(api.access_token).toBe('new-access');
                expect(api.refresh_token).toBe('new-refresh');
                expect(delegate.receiveNotification).toHaveBeenCalledWith(
                    api,
                    api.DLGT_TOKEN_UPDATE,
                    null
                );
            });
        });
    });

    describe('getUserDetails', () => {
        it('returns the response of users/me with the bearer token', async () => {
            const user = userWith();
            const scope = nock('https://api.freshbooks.com', {
                reqheaders: {
                    authorization: 'Bearer live-access',
                    'api-version': 'alpha',
                },
            })
                .get('/auth/api/v1/users/me')
                .reply(200, { response: user });
            const api = createApi({
                access_token: 'live-access',
                refresh_token: 'live-refresh',
            });

            const details = await api.getUserDetails();

            expect(scope.isDone()).toBe(true);
            expect(details).toEqual(user);
        });

        it('remembers the FreshBooks user id for later persistence', async () => {
            nock('https://api.freshbooks.com')
                .get('/auth/api/v1/users/me')
                .reply(200, { response: { id: 42 } });
            const api = createApi({
                access_token: 'live-access',
                refresh_token: 'live-refresh',
            });

            await api.getUserDetails();

            expect(api.freshbooksUserId).toBe('42');
        });

        it.each([{}, { id: null }])(
            'throws a clear error when the response has no id (%p)',
            async (body) => {
                nock('https://api.freshbooks.com')
                    .get('/auth/api/v1/users/me')
                    .reply(200, { response: body });
                const api = createApi({
                    access_token: 'live-access',
                    refresh_token: 'live-refresh',
                });

                await expect(api.getUserDetails()).rejects.toThrow(/user id/i);
                expect(api.freshbooksUserId).toBeNull();
            }
        );

        it('restores the user id from persisted credential params', () => {
            expect(createApi({ freshbooksUserId: '42' }).freshbooksUserId).toBe(
                '42'
            );
        });
    });

    describe('accounting endpoints', () => {
        const ACCOUNT = 'acct-1';
        const CLIENTS_PATH = `/accounting/account/${ACCOUNT}/users/clients`;
        const CALLBACKS_PATH = `/events/account/${ACCOUNT}/events/callbacks`;
        const authedApi = (params = {}) =>
            createApi({
                access_token: 'live-access',
                refresh_token: 'live-refresh',
                backOff: [0],
                ...params,
            });
        const freshbooks = () =>
            nock('https://api.freshbooks.com', {
                reqheaders: {
                    authorization: 'Bearer live-access',
                    'api-version': 'alpha',
                },
            });
        const result = (payload) => ({ response: { result: payload } });

        describe('listClients', () => {
            it('requests the page newest-updated first and returns the clients with the page count', async () => {
                const clients = [{ id: 1 }, { id: 2 }];
                const scope = freshbooks()
                    .get(CLIENTS_PATH)
                    .query({ page: '2', per_page: '50', sort: 'updated_desc' })
                    .reply(
                        200,
                        result({
                            clients,
                            page: 2,
                            pages: 5,
                            per_page: 50,
                            total: 230,
                        })
                    );

                const page = await authedApi().listClients(ACCOUNT, {
                    page: 2,
                    perPage: 50,
                });

                expect(scope.isDone()).toBe(true);
                expect(page).toEqual({ clients, pages: 5 });
            });

            it('defaults to page 1 with 100 per page', async () => {
                const scope = freshbooks()
                    .get(CLIENTS_PATH)
                    .query({ page: '1', per_page: '100', sort: 'updated_desc' })
                    .reply(200, result({ clients: [], page: 1, pages: 0 }));

                const page = await authedApi().listClients(ACCOUNT);

                expect(scope.isDone()).toBe(true);
                expect(page).toEqual({ clients: [], pages: 0 });
            });
        });

        describe('getClient', () => {
            it('returns the unwrapped client', async () => {
                const scope = freshbooks()
                    .get(`${CLIENTS_PATH}/7`)
                    .reply(200, result({ client: { id: 7, email: 'a@b.co' } }));

                const client = await authedApi().getClient(ACCOUNT, 7);

                expect(scope.isDone()).toBe(true);
                expect(client).toEqual({ id: 7, email: 'a@b.co' });
            });
        });

        describe('findClientsByEmail', () => {
            it('searches by email newest-updated first and returns the clients array', async () => {
                const scope = freshbooks()
                    .get(CLIENTS_PATH)
                    .query({
                        'search[email]': 'a+b@example.com',
                        sort: 'updated_desc',
                    })
                    .reply(200, result({ clients: [{ id: 3 }] }));

                const clients = await authedApi().findClientsByEmail(
                    ACCOUNT,
                    'a+b@example.com'
                );

                expect(scope.isDone()).toBe(true);
                expect(clients).toEqual([{ id: 3 }]);
            });

            it('sends the email trimmed', async () => {
                const scope = freshbooks()
                    .get(CLIENTS_PATH)
                    .query({ 'search[email]': 'a@b.co', sort: 'updated_desc' })
                    .reply(200, result({ clients: [] }));

                await authedApi().findClientsByEmail(ACCOUNT, '  a@b.co ');

                expect(scope.isDone()).toBe(true);
            });

            it.each(['', '   ', undefined, null])(
                'throws without calling FreshBooks when email is %p',
                async (email) => {
                    const scope = freshbooks()
                        .get(CLIENTS_PATH)
                        .query(true)
                        .reply(200, {});

                    await expect(
                        authedApi().findClientsByEmail(ACCOUNT, email)
                    ).rejects.toThrow(/email/i);
                    expect(scope.isDone()).toBe(false);
                }
            );
        });

        describe('createClient', () => {
            it('posts the client wrapped in a client key and returns the created client', async () => {
                const scope = freshbooks()
                    .post(CLIENTS_PATH, {
                        client: { email: 'a@b.co', fname: 'Ada' },
                    })
                    .reply(200, result({ client: { id: 9, email: 'a@b.co' } }));

                const client = await authedApi().createClient(ACCOUNT, {
                    email: 'a@b.co',
                    fname: 'Ada',
                });

                expect(scope.isDone()).toBe(true);
                expect(client).toEqual({ id: 9, email: 'a@b.co' });
            });
        });

        describe('updateClient', () => {
            it('puts the client wrapped in a client key and returns the updated client', async () => {
                const scope = freshbooks()
                    .put(`${CLIENTS_PATH}/9`, { client: { fname: 'Grace' } })
                    .reply(200, result({ client: { id: 9, fname: 'Grace' } }));

                const client = await authedApi().updateClient(ACCOUNT, 9, {
                    fname: 'Grace',
                });

                expect(scope.isDone()).toBe(true);
                expect(client).toEqual({ id: 9, fname: 'Grace' });
            });
        });

        describe('getInvoice', () => {
            it('returns the unwrapped invoice', async () => {
                const scope = freshbooks()
                    .get(`/accounting/account/${ACCOUNT}/invoices/invoices/11`)
                    .reply(200, result({ invoice: { id: 11, userid: 7 } }));

                const invoice = await authedApi().getInvoice(ACCOUNT, 11);

                expect(scope.isDone()).toBe(true);
                expect(invoice).toEqual({ id: 11, userid: 7 });
            });
        });

        describe('getPayment', () => {
            it('includes the invoice as a query string, not in the path', async () => {
                let requestedPath;
                const scope = freshbooks()
                    .get(/\/payments\/payments\/21/)
                    .reply(200, function () {
                        requestedPath = this.req.path;
                        return result({ payment: { id: 21, invoiceid: 11 } });
                    });

                const payment = await authedApi().getPayment(ACCOUNT, 21);

                expect(scope.isDone()).toBe(true);
                expect(requestedPath).toBe(
                    `/accounting/account/${ACCOUNT}/payments/payments/21?include%5B%5D=invoice`
                );
                expect(payment).toEqual({ id: 21, invoiceid: 11 });
            });
        });

        describe('listClientInvoices', () => {
            it("returns the client's newest invoices and how many it has", async () => {
                let requestedPath;
                const scope = freshbooks()
                    .get(/\/invoices\/invoices/)
                    .reply(200, function () {
                        requestedPath = this.req.path;
                        return result({ invoices: [{ id: 11 }], total: 240 });
                    });

                const page = await authedApi().listClientInvoices(
                    ACCOUNT,
                    7,
                    5
                );

                expect(scope.isDone()).toBe(true);
                expect(requestedPath).toBe(
                    `/accounting/account/${ACCOUNT}/invoices/invoices?search%5Bcustomerid%5D=7&sort=invoice_date_desc&per_page=5`
                );
                expect(page).toEqual({ records: [{ id: 11 }], total: 240 });
            });
        });

        describe('listClientPayments', () => {
            it("returns the client's newest payments with their invoice and how many it has", async () => {
                let requestedPath;
                const scope = freshbooks()
                    .get(/\/payments\/payments/)
                    .reply(200, function () {
                        requestedPath = this.req.path;
                        return result({ payments: [{ id: 21 }], total: 130 });
                    });

                const page = await authedApi().listClientPayments(
                    ACCOUNT,
                    7,
                    5
                );

                expect(scope.isDone()).toBe(true);
                expect(requestedPath).toBe(
                    `/accounting/account/${ACCOUNT}/payments/payments?search%5Bclientid%5D=7&include%5B%5D=invoice&sort=updated_desc&per_page=5`
                );
                expect(page).toEqual({ records: [{ id: 21 }], total: 130 });
            });
        });

        describe('callbacks', () => {
            it('createCallback posts event and uri wrapped in a callback key', async () => {
                const scope = freshbooks()
                    .post(CALLBACKS_PATH, {
                        callback: {
                            event: 'invoice.create',
                            uri: 'https://hook.example.com/x',
                        },
                    })
                    .reply(
                        200,
                        result({ callback: { callbackid: 5, verified: false } })
                    );

                const callback = await authedApi().createCallback(ACCOUNT, {
                    event: 'invoice.create',
                    uri: 'https://hook.example.com/x',
                });

                expect(scope.isDone()).toBe(true);
                expect(callback).toEqual({ callbackid: 5, verified: false });
            });

            it('verifyCallback puts the callback id and verifier', async () => {
                const scope = freshbooks()
                    .put(`${CALLBACKS_PATH}/5`, {
                        callback: { callback_id: 5, verifier: 'abc' },
                    })
                    .reply(
                        200,
                        result({ callback: { callbackid: 5, verified: true } })
                    );

                const callback = await authedApi().verifyCallback(
                    ACCOUNT,
                    5,
                    'abc'
                );

                expect(scope.isDone()).toBe(true);
                expect(callback).toEqual({ callbackid: 5, verified: true });
            });

            it('resendCallbackVerification asks FreshBooks to resend the verifier', async () => {
                const scope = freshbooks()
                    .put(`${CALLBACKS_PATH}/5`, { callback: { resend: true } })
                    .reply(
                        200,
                        result({ callback: { callbackid: 5, verified: false } })
                    );

                const callback = await authedApi().resendCallbackVerification(
                    ACCOUNT,
                    5
                );

                expect(scope.isDone()).toBe(true);
                expect(callback).toEqual({ callbackid: 5, verified: false });
            });

            it('listCallbacks returns one page of callbacks with the page count', async () => {
                const callbacks = [
                    {
                        callbackid: 5,
                        event: 'invoice',
                        uri: 'https://x',
                        verified: true,
                    },
                ];
                const scope = freshbooks()
                    .get(CALLBACKS_PATH)
                    .query({ page: '2', per_page: '100' })
                    .reply(200, result({ callbacks, page: 2, pages: 3 }));

                const page = await authedApi().listCallbacks(ACCOUNT, {
                    page: 2,
                });

                expect(scope.isDone()).toBe(true);
                expect(page).toEqual({ callbacks, pages: 3 });
            });

            it('getCallback returns the unwrapped callback', async () => {
                const scope = freshbooks()
                    .get(`${CALLBACKS_PATH}/5`)
                    .reply(
                        200,
                        result({ callback: { callbackid: 5, verified: true } })
                    );

                const callback = await authedApi().getCallback(ACCOUNT, 5);

                expect(scope.isDone()).toBe(true);
                expect(callback).toEqual({ callbackid: 5, verified: true });
            });

            it('deleteCallback deletes the callback', async () => {
                const scope = freshbooks()
                    .delete(`${CALLBACKS_PATH}/5`)
                    .reply(200, {});

                await authedApi().deleteCallback(ACCOUNT, 5);

                expect(scope.isDone()).toBe(true);
            });
        });

        describe('concurrent requests from different tenants', () => {
            it('sends each request with its own bearer token', async () => {
                const tenant = (token, email) =>
                    nock('https://api.freshbooks.com', {
                        reqheaders: { authorization: `Bearer ${token}` },
                    })
                        .post(CLIENTS_PATH, { client: { email } })
                        .reply(200, result({ client: { id: token } }));
                const scopeA = tenant('token-a', 'a@x.co');
                const scopeB = tenant('token-b', 'b@x.co');

                const [clientA, clientB] = await Promise.all([
                    authedApi({ access_token: 'token-a' }).createClient(
                        ACCOUNT,
                        {
                            email: 'a@x.co',
                        }
                    ),
                    authedApi({ access_token: 'token-b' }).createClient(
                        ACCOUNT,
                        {
                            email: 'b@x.co',
                        }
                    ),
                ]);

                expect(scopeA.isDone()).toBe(true);
                expect(scopeB.isDone()).toBe(true);
                expect(clientA).toEqual({ id: 'token-a' });
                expect(clientB).toEqual({ id: 'token-b' });
            });
        });

        describe('error responses', () => {
            it('propagates a 4xx with its status code', async () => {
                freshbooks()
                    .get(`${CLIENTS_PATH}/7`)
                    .reply(404, { message: 'not found' });

                await expect(
                    authedApi().getClient(ACCOUNT, 7)
                ).rejects.toMatchObject({
                    statusCode: 404,
                });
            });
        });

        describe('server errors on non-token requests', () => {
            it('retries a 502 with backoff and returns the eventual 200', async () => {
                const scope = freshbooks()
                    .get(`${CLIENTS_PATH}/7`)
                    .reply(502, {})
                    .get(`${CLIENTS_PATH}/7`)
                    .reply(200, result({ client: { id: 7 } }));

                const client = await authedApi().getClient(ACCOUNT, 7);

                expect(scope.isDone()).toBe(true);
                expect(client).toEqual({ id: 7 });
            });
        });

        describe('rate limiting', () => {
            it('retries a 429 and returns the eventual 200', async () => {
                const scope = freshbooks()
                    .get(`${CLIENTS_PATH}/7`)
                    .reply(429, {})
                    .get(`${CLIENTS_PATH}/7`)
                    .reply(200, result({ client: { id: 7 } }));

                const client = await authedApi().getClient(ACCOUNT, 7);

                expect(scope.isDone()).toBe(true);
                expect(client).toEqual({ id: 7 });
            });
        });
    });
});
