const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example.com/redirect/klaviyo',
        scope: 'profiles:read',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: { id: 'created' } };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { data: { id: 'updated' } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Klaviyo Api', () => {
    describe('construction & auth', () => {
        it('sets base URL, token URI, and revision', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://a.klaviyo.com');
            expect(api.tokenUri).toBe('https://a.klaviyo.com/oauth/token');
            expect(api.authorizeBase).toBe(
                'https://www.klaviyo.com/oauth/authorize'
            );
            expect(api.revision).toBe('2026-10-15');
        });

        it('emits Bearer for OAuth access_token', async () => {
            const api = new Api({ access_token: 'atok' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer atok');
        });

        it('falls back to Klaviyo-API-Key when only api_key is set', async () => {
            const api = new Api({ api_key: 'pk_secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Klaviyo-API-Key pk_secret');
        });

        it('prefers Bearer over api_key when both are set', async () => {
            const api = new Api({
                access_token: 'atok',
                api_key: 'pk_secret',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer atok');
        });

        it('builds an authorize URL with PKCE S256', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'csec',
                redirect_uri: 'https://app.example.com/redirect/klaviyo',
                scope: 'profiles:read profiles:write',
                state: 'cust-1',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                'https://www.klaviyo.com/oauth/authorize?'
            );
            expect(url).toContain('response_type=code');
            expect(url).toContain('client_id=cid');
            expect(url).toContain('code_challenge_method=S256');
            expect(url).toContain('code_challenge=');
            const state = new URL(url).searchParams.get('state');
            expect(state.startsWith('cust-1~')).toBe(true);
            expect(api.code_verifier).toBeTruthy();
            expect(api.code_verifier.length).toBeGreaterThanOrEqual(43);
            expect(state.endsWith(api.code_verifier)).toBe(true);
        });

        it('restores code_verifier from packed state', () => {
            const api = new Api({});
            api.restorePkceFromState('caller~verifier-abc');
            expect(api.code_verifier).toBe('verifier-abc');
        });

        it('exchanges code with Basic Auth + code_verifier', async () => {
            const api = makeApi({ access_token: null });
            api.code_verifier = 'verifier-xyz';
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe('https://a.klaviyo.com/oauth/token');
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('code=auth-code');
            expect(body).toContain('code_verifier=verifier-xyz');
        });

        it('refreshes with Basic Auth and refresh_token grant', async () => {
            const api = makeApi({ access_token: 'old' });
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'r1' });
            const captured = api._captured[0];
            expect(captured.url).toBe('https://a.klaviyo.com/oauth/token');
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            const body = captured.body.toString();
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain('refresh_token=r1');
            expect(body).not.toContain('client_secret=');
        });
    });

    describe('accounts', () => {
        it('listAccounts hits GET /api/accounts/ with revision', async () => {
            const api = makeApi();
            await api.listAccounts();
            const captured = api._captured[0];
            expect(captured.url).toBe('https://a.klaviyo.com/api/accounts/');
            expect(captured.headers.revision).toBe('2026-10-15');
            expect(captured.headers.Accept).toBe('application/json');
        });

        it('getAccount hits GET /api/accounts/{id}/', async () => {
            const api = makeApi();
            await api.getAccount('abc123');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/accounts/abc123/'
            );
        });
    });

    describe('profiles', () => {
        it('listProfiles / getProfile / createProfile / updateProfile', async () => {
            const api = makeApi();
            await api.listProfiles({
                filter: "equals(email,'a@b.com')",
                'page[cursor]': 'cur1',
            });
            await api.getProfile('p1');
            await api.createProfile({
                data: { type: 'profile', attributes: { email: 'a@b.com' } },
            });
            await api.updateProfile('p1', {
                data: {
                    type: 'profile',
                    id: 'p1',
                    attributes: { first_name: 'A' },
                },
            });
            expect(api._captured[0].url).toContain('/api/profiles/');
            expect(api._captured[0].url).toContain('filter=equals');
            expect(api._captured[2].headers['Content-Type']).toBe(
                'application/vnd.api+json'
            );
            expect(api._captured[3].method).toBe('PATCH');
        });

        it('createOrUpdateProfile POSTs /api/profile-import/', async () => {
            const api = makeApi();
            const body = {
                data: {
                    type: 'profile',
                    attributes: { email: 'a@b.com' },
                },
            };
            await api.createOrUpdateProfile(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/profile-import/'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('getProfileLists hits GET /api/profiles/{id}/lists/', async () => {
            const api = makeApi();
            await api.getProfileLists('p1');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/profiles/p1/lists/'
            );
        });

        it('subscribeProfiles POSTs bulk-create-jobs', async () => {
            const api = makeApi();
            const body = {
                data: {
                    type: 'profile-subscription-bulk-create-job',
                    attributes: {
                        profiles: {
                            data: [
                                {
                                    type: 'profile',
                                    attributes: {
                                        email: 'a@b.com',
                                        subscriptions: {},
                                    },
                                },
                            ],
                        },
                    },
                },
            };
            await api.subscribeProfiles(body);
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('unsubscribeProfiles POSTs bulk-delete-jobs', async () => {
            const api = makeApi();
            await api.unsubscribeProfiles({
                data: {
                    type: 'profile-subscription-bulk-delete-job',
                    attributes: {
                        profiles: {
                            data: [
                                {
                                    type: 'profile',
                                    attributes: { email: 'a@b.com' },
                                },
                            ],
                        },
                    },
                },
            });
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/profile-subscription-bulk-delete-jobs/'
            );
        });
    });

    describe('lists / events / segments / campaigns / metrics / webhooks', () => {
        it('covers core paths', async () => {
            const api = makeApi();
            await api.listLists();
            await api.addProfilesToList('L1', {
                data: [{ type: 'profile', id: 'p1' }],
            });
            await api.listEvents();
            await api.createEvent({
                data: { type: 'event', attributes: {} },
            });
            await api.listSegments();
            await api.listCampaigns({
                filter: "equals(messages.channel,'email')",
            });
            await api.listMetrics();
            await api.createWebhook({
                data: {
                    type: 'webhook',
                    attributes: {
                        name: 'Hook',
                        endpoint_url: 'https://example.com/hook',
                        secret_key: 'sixteen-chars-min',
                    },
                    relationships: {
                        'webhook-topics': {
                            data: [
                                {
                                    type: 'webhook-topic',
                                    id: 'event:klaviyo.opened_email',
                                },
                            ],
                        },
                    },
                },
            });
            await api.deleteWebhook('w1');
            expect(api._captured[0].url).toBe(
                'https://a.klaviyo.com/api/lists/'
            );
            expect(api._captured[7].url).toBe(
                'https://a.klaviyo.com/api/webhooks/'
            );
            expect(api._captured[8].method).toBe('DELETE');
        });
    });
});
