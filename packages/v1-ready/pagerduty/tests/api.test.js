const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'pd-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/pagerduty',
        access_token: 'tok',
        refresh_token: 'ref',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return {
            access_token: 'new',
            refresh_token: 'ref',
            id_token: Buffer.from(
                JSON.stringify({ alg: 'none' })
            ).toString('base64url') +
                '.' +
                Buffer.from(
                    JSON.stringify({
                        account_id: 'ACCT1',
                        subdomain: 'acme',
                        user_id: 'USER1',
                    })
                ).toString('base64url') +
                '.sig',
        };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('PagerDuty Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to api.pagerduty.com', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://api.pagerduty.com');
            expect(api.tokenUri).toBe(
                'https://identity.pagerduty.com/oauth/token'
            );
            expect(api.acceptHeader).toBe(
                'application/vnd.pagerduty+json;version=2'
            );
        });

        it('builds an authorize URL with client_id, scope, and redirect_uri', () => {
            const api = new Api({
                client_id: 'pd-abc',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/pagerduty',
                scope: 'write',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://identity.pagerduty.com/oauth/authorize?'
            );
            expect(uri).toContain('client_id=pd-abc');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('scope=write');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fpagerduty'
            );
            expect(uri).toContain('state=xyz');
        });

        it('adds Bearer and Accept version headers', async () => {
            const api = new Api({
                access_token: 'tok-1',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-1');
            expect(headers.Accept).toBe(
                'application/vnd.pagerduty+json;version=2'
            );
        });

        it('captures account claims from id_token in setTokens', async () => {
            const api = makeApi({ access_token: null });
            // Bypass real form token exchange; exercise setTokens path.
            const idToken =
                Buffer.from(JSON.stringify({ alg: 'none' })).toString(
                    'base64url'
                ) +
                '.' +
                Buffer.from(
                    JSON.stringify({
                        account_id: 'PE6RLQ4',
                        subdomain: 'pdt-hannale',
                        user_id: 'PIYKDBN',
                    })
                ).toString('base64url') +
                '.x';
            await api.setTokens({
                access_token: 'a',
                refresh_token: 'r',
                expires_in: 3600,
                id_token: idToken,
            });
            expect(api.account_id).toBe('PE6RLQ4');
            expect(api.subdomain).toBe('pdt-hannale');
            expect(api.user_id).toBe('PIYKDBN');
        });
    });

    describe('users', () => {
        it('getCurrentUser hits GET /users/me', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://api.pagerduty.com/users/me'
            );
        });

        it('listUsers serializes scalar and [] array query params on the URL', async () => {
            const api = makeApi();
            await api.listUsers({
                limit: 25,
                query: 'ada',
                team_ids: ['T1', 'T2'],
                include: ['teams'],
            });
            const { url } = api._captured[0];
            expect(url.startsWith('https://api.pagerduty.com/users?')).toBe(
                true
            );
            expect(url).toContain('limit=25');
            expect(url).toContain('query=ada');
            expect(url).toContain('team_ids%5B%5D=T1');
            expect(url).toContain('team_ids%5B%5D=T2');
            expect(url).toContain('include%5B%5D=teams');
        });

        it('getUser hits GET /users/{id} and supports include[]', async () => {
            const api = makeApi();
            await api.getUser('PUSER1', { include: ['contact_methods'] });
            expect(api._captured[0].url).toBe(
                'https://api.pagerduty.com/users/PUSER1?include%5B%5D=contact_methods'
            );
        });

        it('createUser sends From header and JSON body', async () => {
            const api = makeApi();
            await api.createUser(
                { user: { name: 'Ada', email: 'ada@ex.com', type: 'user' } },
                { from: 'admin@ex.com' }
            );
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.pagerduty.com/users'
            );
            expect(api._captured[0].headers.From).toBe('admin@ex.com');
            expect(api._captured[0].body.user.email).toBe('ada@ex.com');
        });

        it('updateUser hits PUT /users/{id}', async () => {
            const api = makeApi();
            await api.updateUser('PUSER1', {
                user: { name: 'Ada Lovelace', type: 'user' },
            });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.pagerduty.com/users/PUSER1'
            );
        });
    });

    describe('incidents', () => {
        it('listIncidents uses official statuses[] / since / until names', async () => {
            const api = makeApi();
            await api.listIncidents({
                statuses: ['triggered', 'acknowledged'],
                limit: 10,
                since: '2026-01-01T00:00:00Z',
                until: '2026-02-01T00:00:00Z',
                sort_by: ['created_at:desc', 'urgency:asc'],
            });
            const { url } = api._captured[0];
            expect(url).toContain('https://api.pagerduty.com/incidents?');
            expect(url).toContain('statuses%5B%5D=triggered');
            expect(url).toContain('statuses%5B%5D=acknowledged');
            expect(url).toContain('since=2026-01-01T00%3A00%3A00Z');
            expect(url).toContain('until=2026-02-01T00%3A00%3A00Z');
            // style=form explode=false → comma-joined
            expect(url).toContain(
                'sort_by=created_at%3Adesc%2Curgency%3Aasc'
            );
        });

        it('getIncident hits GET /incidents/{id}', async () => {
            const api = makeApi();
            await api.getIncident('PINC1');
            expect(api._captured[0].url).toBe(
                'https://api.pagerduty.com/incidents/PINC1'
            );
        });

        it('createIncident requires From header', async () => {
            const api = makeApi();
            await api.createIncident(
                {
                    incident: {
                        type: 'incident',
                        title: 'Disk full',
                        service: { id: 'PSVC', type: 'service_reference' },
                    },
                },
                { from: 'oncall@ex.com' }
            );
            expect(api._captured[0].headers.From).toBe('oncall@ex.com');
            expect(api._captured[0].url).toBe(
                'https://api.pagerduty.com/incidents'
            );
        });

        it('updateIncident hits PUT /incidents/{id}', async () => {
            const api = makeApi();
            await api.updateIncident(
                'PINC1',
                { incident: { type: 'incident_reference', status: 'resolved' } },
                { from: 'oncall@ex.com' }
            );
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].headers.From).toBe('oncall@ex.com');
        });
    });

    describe('services', () => {
        it('listServices / getService / createService / updateService', async () => {
            const api = makeApi();
            await api.listServices({
                limit: 5,
                team_ids: ['TEAM1'],
                sort_by: 'name:asc',
                name: 'API',
            });
            await api.getService('PSVC1', { include: ['teams'] });
            await api.createService({
                service: {
                    name: 'API',
                    type: 'service',
                    escalation_policy: {
                        id: 'PEP',
                        type: 'escalation_policy_reference',
                    },
                },
            });
            await api.updateService('PSVC1', {
                service: { name: 'API v2', type: 'service' },
            });
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
            ]);
            expect(api._captured[0].url).toContain('team_ids%5B%5D=TEAM1');
            expect(api._captured[0].url).toContain('sort_by=name%3Aasc');
            expect(api._captured[0].url).toContain('name=API');
            expect(api._captured[1].url).toBe(
                'https://api.pagerduty.com/services/PSVC1?include%5B%5D=teams'
            );
            expect(api._captured[3].url).toBe(
                'https://api.pagerduty.com/services/PSVC1'
            );
        });
    });

    describe('webhook subscriptions', () => {
        it('CRUD paths match the official OpenAPI', async () => {
            const api = makeApi();
            await api.listWebhookSubscriptions({
                limit: 10,
                filter_type: 'service',
                filter_id: 'PSVC1',
            });
            expect(api._captured[0].url).toContain('filter_type=service');
            expect(api._captured[0].url).toContain('filter_id=PSVC1');
            await api.getWebhookSubscription('PWH1');
            await api.createWebhookSubscription({
                webhook_subscription: {
                    type: 'webhook_subscription',
                    delivery_method: {
                        type: 'http_delivery_method',
                        url: 'https://example.com/hooks',
                    },
                    events: ['incident.triggered'],
                    filter: { type: 'account_reference' },
                },
            });
            await api.updateWebhookSubscription('PWH1', {
                webhook_subscription: {
                    type: 'webhook_subscription',
                    description: 'updated',
                },
            });
            await api.deleteWebhookSubscription('PWH1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[1].url).toBe(
                'https://api.pagerduty.com/webhook_subscriptions/PWH1'
            );
            expect(api._captured[2].url).toBe(
                'https://api.pagerduty.com/webhook_subscriptions'
            );
            expect(api._captured[4].url).toBe(
                'https://api.pagerduty.com/webhook_subscriptions/PWH1'
            );
        });
    });
});
