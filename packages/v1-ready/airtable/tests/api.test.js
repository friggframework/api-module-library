const crypto = require('crypto');
const {
    Api,
    verifyAirtableContentMac,
    STATE_VERIFIER_DELIMITER,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example/redirect/airtable',
        scope: 'data.records:read schema.bases:read webhook:manage',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        // Token endpoint responses need access_token for setTokens();
        // webhook create responses return id + macSecretBase64.
        if (options.url && String(options.url).includes('/oauth2/')) {
            return {
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                expires_in: 3600,
                refresh_expires_in: 5184000,
                token_type: 'Bearer',
                scope: 'data.records:read',
            };
        }
        return { id: 'ach1', macSecretBase64: 'c2VjcmV0' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Airtable Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL', () => {
            const api = makeApi();
            expect(api.baseUrl).toBe('https://api.airtable.com/v0');
        });

        it('builds an authorize URL with PKCE S256 and encrypts verifier into state', () => {
            const api = makeApi({ state: 'caller' });
            const url = api.getAuthorizationUri();
            const parsed = new URL(url);
            expect(parsed.origin + parsed.pathname).toBe(
                'https://airtable.com/oauth2/v1/authorize'
            );
            expect(parsed.searchParams.get('response_type')).toBe('code');
            expect(parsed.searchParams.get('code_challenge_method')).toBe(
                'S256'
            );
            expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
            expect(parsed.searchParams.get('client_id')).toBe('cid');
            const state = parsed.searchParams.get('state');
            expect(state.startsWith(`caller${STATE_VERIFIER_DELIMITER}`)).toBe(
                true
            );
            expect(api.code_verifier).toBeTruthy();
        });

        it('restores the PKCE verifier from state', () => {
            const api = makeApi();
            const url = api.getAuthorizationUri();
            const verifier = api.code_verifier;
            const state = new URL(url).searchParams.get('state');

            const other = makeApi();
            other.code_verifier = null;
            other.restoreVerifierFromState(state);
            expect(other.code_verifier).toBe(verifier);
        });

        it('getTokenFromCode posts form body with code_verifier and Basic auth', async () => {
            const api = makeApi();
            api.code_verifier = 'verifier-value';
            await api.getTokenFromCode('the-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe('https://airtable.com/oauth2/v1/token');
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            expect(captured.body).toContain('grant_type=authorization_code');
            expect(captured.body).toContain('code=the-code');
            expect(captured.body).toContain('code_verifier=verifier-value');
            expect(api.code_verifier).toBeNull();
        });

        it('refreshAccessToken posts refresh_token grant', async () => {
            const api = makeApi({ refresh_token: 'r1' });
            await api.refreshAccessToken({ refresh_token: 'r1' });
            const captured = api._captured[0];
            expect(captured.url).toBe('https://airtable.com/oauth2/v1/token');
            expect(captured.body).toContain('grant_type=refresh_token');
            expect(captured.body).toContain('refresh_token=r1');
        });

        it('getAuthorizationRequirements returns oauth2', () => {
            const api = makeApi();
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('code_challenge=');
        });
    });

    describe('identity & bases', () => {
        it('getWhoami hits GET /meta/whoami', async () => {
            const api = makeApi();
            await api.getWhoami();
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/meta/whoami'
            );
        });

        it('listBases hits GET /meta/bases', async () => {
            const api = makeApi();
            await api.listBases({ offset: 'o1' });
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/meta/bases'
            );
            expect(api._captured[0].query).toEqual({ offset: 'o1' });
        });

        it('getBaseSchema hits GET /meta/bases/{baseId}/tables', async () => {
            const api = makeApi();
            await api.getBaseSchema('appX');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/meta/bases/appX/tables'
            );
        });
    });

    describe('records', () => {
        it('listRecords hits GET /{baseId}/{table}', async () => {
            const api = makeApi();
            await api.listRecords('app1', 'tbl1', { pageSize: 50 });
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/app1/tbl1'
            );
            expect(api._captured[0].query.pageSize).toBe(50);
        });

        it('encodes table names in the path', async () => {
            const api = makeApi();
            await api.listRecords('app1', 'My Table');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/app1/My%20Table'
            );
        });

        it('getRecord hits GET /{baseId}/{table}/{recordId}', async () => {
            const api = makeApi();
            await api.getRecord('app1', 'tbl1', 'rec1');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/app1/tbl1/rec1'
            );
        });

        it('createRecords POSTs JSON body', async () => {
            const api = makeApi();
            const body = { fields: { Name: 'A' } };
            await api.createRecords('app1', 'tbl1', body);
            const c = api._captured[0];
            expect(c.method).toBe('POST');
            expect(c.url).toBe('https://api.airtable.com/v0/app1/tbl1');
            expect(c.body).toEqual(body);
        });

        it('updateRecord PATCHes a single record', async () => {
            const api = makeApi();
            await api.updateRecord('app1', 'tbl1', 'rec1', {
                fields: { Name: 'B' },
            });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/app1/tbl1/rec1'
            );
        });

        it('updateRecords PATCHes the table collection', async () => {
            const api = makeApi();
            await api.updateRecords('app1', 'tbl1', {
                records: [{ id: 'rec1', fields: { Name: 'C' } }],
            });
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/app1/tbl1'
            );
        });

        it('deleteRecord hits DELETE', async () => {
            const api = makeApi();
            await api.deleteRecord('app1', 'tbl1', 'rec1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/app1/tbl1/rec1'
            );
        });
    });

    describe('webhooks', () => {
        it('listWebhooks hits GET /bases/{baseId}/webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks('app1');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/bases/app1/webhooks'
            );
        });

        it('createWebhook POSTs specification', async () => {
            const api = makeApi();
            const body = {
                notificationUrl: 'https://hook.example/airtable',
                specification: {
                    options: { filters: { dataTypes: ['tableData'] } },
                },
            };
            await api.createWebhook('app1', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.airtable.com/v0/bases/app1/webhooks'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('deleteWebhook / refreshWebhook / listWebhookPayloads / toggle paths', async () => {
            const api = makeApi();
            await api.deleteWebhook('app1', 'ach1');
            await api.refreshWebhook('app1', 'ach1');
            await api.listWebhookPayloads('app1', 'ach1', { cursor: 1 });
            await api.toggleWebhookNotifications('app1', 'ach1', {
                enable: true,
            });
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.airtable.com/v0/bases/app1/webhooks/ach1',
                'https://api.airtable.com/v0/bases/app1/webhooks/ach1/refresh',
                'https://api.airtable.com/v0/bases/app1/webhooks/ach1/payloads',
                'https://api.airtable.com/v0/bases/app1/webhooks/ach1/enableNotifications',
            ]);
        });
    });

    describe('verifyAirtableContentMac', () => {
        it('accepts a correctly signed notification body', () => {
            const secret = Buffer.from('super-secret-mac-key');
            const macSecretBase64 = secret.toString('base64');
            const payload = {
                base: { id: 'app1' },
                webhook: { id: 'ach1' },
                timestamp: '2022-02-01T21:25:05.663Z',
            };
            const bodyStr = JSON.stringify(payload);
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(bodyStr, 'ascii');
            const header = `hmac-sha256=${hmac.digest('hex')}`;

            const result = verifyAirtableContentMac({
                headers: { 'X-Airtable-Content-MAC': header },
                body: payload,
                macSecretBase64,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a bad MAC', () => {
            const result = verifyAirtableContentMac({
                headers: { 'X-Airtable-Content-MAC': 'hmac-sha256=deadbeef' },
                body: { base: { id: 'app1' }, webhook: { id: 'ach1' } },
                macSecretBase64: Buffer.from('x').toString('base64'),
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('mac_mismatch');
        });
    });
});
