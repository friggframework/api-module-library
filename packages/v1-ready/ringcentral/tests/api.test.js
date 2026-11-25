const {
    Api,
    PRODUCTION_BASE_URL,
    SANDBOX_BASE_URL,
    VERIFICATION_TOKEN_HEADER,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        refresh_token: 'ref',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/ringcentral',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { records: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'sub-1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { ok: true };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('RingCentral Api', () => {
    describe('construction & auth', () => {
        it('defaults to the production platform base URL', () => {
            const api = new Api({ access_token: 'a', refresh_token: 'r' });
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.tokenUri).toBe(
                `${PRODUCTION_BASE_URL}/restapi/oauth/token`
            );
        });

        it('uses the sandbox host when environment=sandbox', () => {
            const api = new Api({
                environment: 'sandbox',
                access_token: 'a',
                refresh_token: 'r',
            });
            expect(api.baseUrl).toBe(SANDBOX_BASE_URL);
            expect(api.tokenUri).toBe(
                `${SANDBOX_BASE_URL}/restapi/oauth/token`
            );
        });

        it('builds the authorize URL with response_type=code', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/ringcentral',
                state: 'st',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                `${PRODUCTION_BASE_URL}/restapi/oauth/authorize?`
            );
            expect(url).toContain('client_id=cid');
            expect(url).toContain('response_type=code');
            expect(url).toContain(
                `redirect_uri=${encodeURIComponent(
                    'https://app.example/redirect/ringcentral'
                )}`
            );
            expect(url).toContain('state=st');
        });

        it('exchanges codes via Basic auth', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app.example/redirect/ringcentral',
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
                    refresh_token_expires_in: 604800,
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

        it('getAuthorizationRequirements returns oauth2 with authorize URL', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/ringcentral',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('/restapi/oauth/authorize');
        });
    });

    describe('account & extensions', () => {
        it('readAccountInfo hits GET /restapi/v1.0/account/~', async () => {
            const api = makeApi();
            await api.readAccountInfo();
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/restapi/v1.0/account/~`
            );
        });

        it('readExtension defaults to ~/~~', async () => {
            const api = makeApi();
            await api.readExtension();
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/restapi/v1.0/account/~/extension/~`
            );
        });

        it('listExtensions forwards query params', async () => {
            const api = makeApi();
            await api.listExtensions('~', { page: 2, perPage: 50 });
            expect(api._captured[0].url).toContain('/extension');
            expect(api._captured[0].query).toEqual({ page: 2, perPage: 50 });
        });

        it('updateExtension PUTs a body', async () => {
            const api = makeApi();
            await api.updateExtension('~', '~', { status: 'Enabled' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].body).toEqual({ status: 'Enabled' });
        });

        it('listAccountPhoneNumbers hits phone-number', async () => {
            const api = makeApi();
            await api.listAccountPhoneNumbers();
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/restapi/v1.0/account/~/phone-number`
            );
        });
    });

    describe('messages & SMS', () => {
        it('listMessages hits message-store', async () => {
            const api = makeApi();
            await api.listMessages('~', '~', { messageType: 'SMS' });
            expect(api._captured[0].url).toContain('/message-store');
            expect(api._captured[0].query.messageType).toBe('SMS');
        });

        it('readMessage requires messageId', async () => {
            const api = makeApi();
            await expect(api.readMessage('~', '~')).rejects.toThrow(
                /messageId/
            );
        });

        it('readMessage hits the message path', async () => {
            const api = makeApi();
            await api.readMessage('~', '~', '123');
            expect(api._captured[0].url).toContain('/message-store/123');
        });

        it('createSMSMessage POSTs to /sms', async () => {
            const api = makeApi();
            const body = {
                from: { phoneNumber: '+15551234567' },
                to: [{ phoneNumber: '+15557654321' }],
                text: 'hello',
            };
            await api.createSMSMessage('~', '~', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain('/sms');
            expect(api._captured[0].body).toEqual(body);
        });

        it('createSMSMessage requires a body', async () => {
            const api = makeApi();
            await expect(api.createSMSMessage()).rejects.toThrow(/body/);
        });
    });

    describe('call log', () => {
        it('readUserCallLog hits call-log', async () => {
            const api = makeApi();
            await api.readUserCallLog('~', '~', { view: 'Simple' });
            expect(api._captured[0].url).toContain('/call-log');
            expect(api._captured[0].query.view).toBe('Simple');
        });

        it('readUserCallRecord requires callRecordId', async () => {
            const api = makeApi();
            await expect(api.readUserCallRecord()).rejects.toThrow(
                /callRecordId/
            );
        });
    });

    describe('contacts', () => {
        it('listContacts hits address-book/contact', async () => {
            const api = makeApi();
            await api.listContacts();
            expect(api._captured[0].url).toContain('/address-book/contact');
        });

        it('createContact POSTs a body', async () => {
            const api = makeApi();
            await api.createContact('~', '~', { firstName: 'Ada' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body.firstName).toBe('Ada');
        });

        it('updateContact PUTs by id', async () => {
            const api = makeApi();
            await api.updateContact('~', '~', '9', { lastName: 'Lovelace' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toContain('/contact/9');
        });
    });

    describe('subscriptions', () => {
        it('createSubscription POSTs eventFilters + deliveryMode', async () => {
            const api = makeApi();
            const body = {
                eventFilters: [
                    '/restapi/v1.0/account/~/extension/~/message-store',
                ],
                deliveryMode: {
                    transportType: 'WebHook',
                    address: 'https://hook.example/rc',
                    verificationToken: 'secret',
                },
            };
            await api.createSubscription(body);
            expect(api._captured[0].url).toBe(
                `${PRODUCTION_BASE_URL}/restapi/v1.0/subscription`
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('listSubscriptions / read / update / delete / renew', async () => {
            const api = makeApi();
            await api.listSubscriptions();
            await api.readSubscription('abc');
            await api.updateSubscription('abc', { eventFilters: [] });
            await api.deleteSubscription('abc');
            await api.renewSubscription('abc');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'PUT',
                'DELETE',
                'POST',
            ]);
            expect(api._captured[4].url).toContain('/subscription/abc/renew');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('returns true when Verification-Token matches', async () => {
            const api = new Api({
                webhookVerificationToken: 'hello-world',
            });
            const ok = await api.verifyWebhookSignature({
                headers: { [VERIFICATION_TOKEN_HEADER]: 'hello-world' },
            });
            expect(ok).toBe(true);
        });

        it('returns false on mismatch or missing config', async () => {
            const api = new Api({
                webhookVerificationToken: 'hello-world',
            });
            expect(
                await api.verifyWebhookSignature({
                    headers: { [VERIFICATION_TOKEN_HEADER]: 'nope' },
                })
            ).toBe(false);
            expect(
                await new Api({}).verifyWebhookSignature({
                    headers: { [VERIFICATION_TOKEN_HEADER]: 'x' },
                })
            ).toBe(false);
        });
    });
});
