const { Api, DEFAULT_SCOPE } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example.com/redirect/zendesk',
        access_token: 'tok',
        subdomain: 'acme',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { tickets: [], users: [], organizations: [], webhooks: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ticket: { id: 1 } };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { ticket: { id: 1 } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { status: 204 };
    };
    return api;
}

describe('Zendesk Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the official OAS server template', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe('https://{subdomain}.{domain}.com');
            expect(api.tokenUri).toBe(
                'https://{subdomain}.{domain}.com/oauth/tokens'
            );
        });

        it('setSubdomain rebuilds baseUrl, tokenUri, and authorize URL', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example.com/redirect/zendesk',
            });
            api.setSubdomain('acme');
            expect(api.baseUrl).toBe('https://acme.zendesk.com');
            expect(api.tokenUri).toBe(
                'https://acme.zendesk.com/oauth/tokens'
            );
            const auth = api.getAuthorizationUri();
            expect(auth).toContain(
                'https://acme.zendesk.com/oauth/authorizations/new?'
            );
            expect(auth).toContain('client_id=cid');
            expect(auth).toContain('response_type=code');
            expect(auth).toContain('scope=');
        });

        it('exposes oauth2 authorization requirements with subdomain form', () => {
            const api = new Api({ subdomain: 'acme', client_id: 'cid' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toContain('subdomain');
            expect(reqs.url).toContain(
                'acme.zendesk.com/oauth/authorizations/new'
            );
        });

        it('uses DEFAULT_SCOPE when none provided', () => {
            const api = new Api({});
            expect(api.scope).toBe(DEFAULT_SCOPE);
            expect(api.scope).toContain('tickets:read');
            expect(api.scope).toContain('webhooks:write');
        });

        it('adds Bearer auth header when access_token is set', async () => {
            const api = new Api({ access_token: 'secret', subdomain: 'acme' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('getTokenFromCode posts JSON to the token endpoint', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    expires_in: 1800,
                    refresh_token_expires_in: 2592000,
                    token_type: 'bearer',
                    scope: 'read',
                };
            };
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://acme.zendesk.com/oauth/tokens'
            );
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body).toMatchObject({
                grant_type: 'authorization_code',
                code: 'auth-code',
                client_id: 'cid',
                client_secret: 'csec',
            });
        });
    });

    describe('identity', () => {
        it('getCurrentUser hits GET /users/me', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://acme.zendesk.com/api/v2/users/me'
            );
        });
    });

    describe('tickets', () => {
        it('listTickets hits GET /tickets with query', async () => {
            const api = makeApi();
            await api.listTickets({ per_page: 50, sort_by: 'updated_at' });
            expect(api._captured[0].url).toBe(
                'https://acme.zendesk.com/api/v2/tickets'
            );
            expect(api._captured[0].query).toEqual({
                per_page: 50,
                sort_by: 'updated_at',
            });
        });

        it('get / create / update / delete ticket paths', async () => {
            const api = makeApi();
            await api.getTicket(12);
            await api.createTicket({
                ticket: {
                    subject: 'Hi',
                    comment: { body: 'Need help' },
                },
            });
            await api.updateTicket(12, { ticket: { status: 'solved' } });
            await api.deleteTicket(12);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.zendesk.com/api/v2/tickets/12'],
                ['POST', 'https://acme.zendesk.com/api/v2/tickets'],
                ['PUT', 'https://acme.zendesk.com/api/v2/tickets/12'],
                ['DELETE', 'https://acme.zendesk.com/api/v2/tickets/12'],
            ]);
        });

        it('listTicketComments hits the comments path', async () => {
            const api = makeApi();
            await api.listTicketComments(99, { per_page: 100 });
            expect(api._captured[0].url).toBe(
                'https://acme.zendesk.com/api/v2/tickets/99/comments'
            );
        });

        it('addTicketComment wraps updateTicket with ticket.comment', async () => {
            const api = makeApi();
            await api.addTicketComment(12, {
                body: 'Thanks',
                public: false,
            });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://acme.zendesk.com/api/v2/tickets/12',
                body: {
                    ticket: { comment: { body: 'Thanks', public: false } },
                },
            });
        });

        it('searchTickets hits GET /search and ensures type:ticket', async () => {
            const api = makeApi();
            await api.searchTickets({ query: 'status:open' });
            expect(api._captured[0].url).toBe(
                'https://acme.zendesk.com/api/v2/search'
            );
            expect(api._captured[0].query.query).toBe(
                'status:open type:ticket'
            );
            await api.searchTickets({ query: 'printer type:ticket' });
            expect(api._captured[1].query.query).toBe('printer type:ticket');
        });
    });

    describe('groups', () => {
        it('listGroups hits GET /groups', async () => {
            const api = makeApi();
            await api.listGroups({ exclude_deleted: true });
            expect(api._captured[0].url).toBe(
                'https://acme.zendesk.com/api/v2/groups'
            );
            expect(api._captured[0].query).toEqual({ exclude_deleted: true });
        });
    });

    describe('webhook signature', () => {
        it('Api.verifyWebhookSignature delegates to the extension verifier', () => {
            const crypto = require('crypto');
            const body = '{"id":"evt-1"}';
            const timestamp = '1710000000';
            const secret = 'signing-secret';
            const signature = crypto
                .createHmac('sha256', secret)
                .update(timestamp + body, 'utf8')
                .digest('base64');
            const ok = Api.verifyWebhookSignature({
                req: {
                    headers: {
                        'x-zendesk-webhook-signature': signature,
                        'x-zendesk-webhook-signature-timestamp': timestamp,
                    },
                    rawBody: body,
                },
                signingSecret: secret,
            });
            expect(ok).toEqual({ valid: true });
            const bad = Api.verifyWebhookSignature({
                req: { headers: {}, rawBody: body },
                signingSecret: secret,
            });
            expect(bad.valid).toBe(false);
        });
    });

    describe('users', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listUsers({ role: 'agent' });
            await api.getUser(5);
            await api.createUser({ user: { name: 'Ada', email: 'a@x.com' } });
            await api.updateUser(5, { user: { name: 'Ada Lovelace' } });
            await api.deleteUser(5);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.zendesk.com/api/v2/users'],
                ['GET', 'https://acme.zendesk.com/api/v2/users/5'],
                ['POST', 'https://acme.zendesk.com/api/v2/users'],
                ['PUT', 'https://acme.zendesk.com/api/v2/users/5'],
                ['DELETE', 'https://acme.zendesk.com/api/v2/users/5'],
            ]);
        });
    });

    describe('organizations', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listOrganizations();
            await api.getOrganization(7);
            await api.createOrganization({ organization: { name: 'Acme' } });
            await api.updateOrganization(7, {
                organization: { name: 'Acme Inc' },
            });
            await api.deleteOrganization(7);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.zendesk.com/api/v2/organizations'],
                ['GET', 'https://acme.zendesk.com/api/v2/organizations/7'],
                ['POST', 'https://acme.zendesk.com/api/v2/organizations'],
                ['PUT', 'https://acme.zendesk.com/api/v2/organizations/7'],
                ['DELETE', 'https://acme.zendesk.com/api/v2/organizations/7'],
            ]);
        });
    });

    describe('webhooks', () => {
        it('CRUD + signing secret paths', async () => {
            const api = makeApi();
            await api.listWebhooks({ 'filter[status]': 'active' });
            await api.getWebhook('01ABC');
            await api.createWebhook({
                webhook: {
                    name: 'Hook',
                    status: 'active',
                    endpoint: 'https://hook.example.com',
                    http_method: 'POST',
                    request_format: 'json',
                    subscriptions: ['conditional_ticket_events'],
                },
            });
            await api.updateWebhook('01ABC', {
                webhook: { name: 'Hook 2', status: 'inactive' },
            });
            await api.deleteWebhook('01ABC');
            await api.getWebhookSigningSecret('01ABC');
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.zendesk.com/api/v2/webhooks'],
                ['GET', 'https://acme.zendesk.com/api/v2/webhooks/01ABC'],
                ['POST', 'https://acme.zendesk.com/api/v2/webhooks'],
                ['PUT', 'https://acme.zendesk.com/api/v2/webhooks/01ABC'],
                ['DELETE', 'https://acme.zendesk.com/api/v2/webhooks/01ABC'],
                [
                    'GET',
                    'https://acme.zendesk.com/api/v2/webhooks/01ABC/signing_secret',
                ],
            ]);
        });
    });
});
