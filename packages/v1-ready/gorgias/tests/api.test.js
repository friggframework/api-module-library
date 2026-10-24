const { Api, DEFAULT_SCOPE } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example.com/redirect/gorgias',
        access_token: 'tok',
        subdomain: 'acme',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [], meta: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { status: 204 };
    };
    return api;
}

describe('Gorgias Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the official OpenAPI server template', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe('https://{domain}.gorgias.com');
            expect(api.tokenUri).toBe('https://{domain}.gorgias.com/oauth/token');
        });

        it('setSubdomain rebuilds baseUrl, tokenUri, and authorize URL', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example.com/redirect/gorgias',
            });
            api.setSubdomain('acme');
            expect(api.baseUrl).toBe('https://acme.gorgias.com');
            expect(api.tokenUri).toBe('https://acme.gorgias.com/oauth/token');
            expect(api.getAuthorizationUri()).toContain(
                'https://acme.gorgias.com/oauth/authorize?'
            );
            expect(api.getAuthorizationUri()).toContain('client_id=cid');
            expect(api.getAuthorizationUri()).toContain('response_type=code');
            expect(api.redirect_uri).toContain('account=acme');
        });

        it('exposes oauth2 authorization requirements with subdomain form', () => {
            const api = new Api({ subdomain: 'acme', client_id: 'cid' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toContain('subdomain');
            expect(reqs.url).toContain('acme.gorgias.com/oauth/authorize');
        });

        it('uses DEFAULT_SCOPE when none provided', () => {
            const api = new Api({});
            expect(api.scope).toBe(DEFAULT_SCOPE);
            expect(api.scope).toContain('offline');
            expect(api.scope).toContain('tickets:read');
        });

        it('adds Bearer auth header when access_token is set', async () => {
            const api = new Api({ access_token: 'secret', subdomain: 'acme' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });
    });

    describe('account', () => {
        it('getAccount hits GET /api/account', async () => {
            const api = makeApi();
            await api.getAccount();
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/account'
            );
        });
    });

    describe('tickets', () => {
        it('listTickets hits GET /api/tickets with query', async () => {
            const api = makeApi();
            await api.listTickets({ limit: 10, customer_id: 5 });
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets'
            );
            expect(api._captured[0].query).toEqual({
                limit: 10,
                customer_id: 5,
            });
        });

        it('getTicket / createTicket / updateTicket / deleteTicket paths', async () => {
            const api = makeApi();
            await api.getTicket(12);
            await api.createTicket({
                messages: [{ body_text: 'hi', channel: 'email', via: 'api' }],
            });
            await api.updateTicket(12, { status: 'closed' });
            await api.deleteTicket(12);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.gorgias.com/api/tickets/12'],
                ['POST', 'https://acme.gorgias.com/api/tickets'],
                ['PUT', 'https://acme.gorgias.com/api/tickets/12'],
                ['DELETE', 'https://acme.gorgias.com/api/tickets/12'],
            ]);
            expect(api._captured[1].body.messages).toHaveLength(1);
        });
    });

    describe('customers', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listCustomers({ email: 'a@b.com' });
            await api.getCustomer(3);
            await api.createCustomer({ name: 'Ada' });
            await api.updateCustomer(3, { name: 'Ada Lovelace' });
            await api.deleteCustomer(3);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.gorgias.com/api/customers'],
                ['GET', 'https://acme.gorgias.com/api/customers/3'],
                ['POST', 'https://acme.gorgias.com/api/customers'],
                ['PUT', 'https://acme.gorgias.com/api/customers/3'],
                ['DELETE', 'https://acme.gorgias.com/api/customers/3'],
            ]);
            expect(api._captured[0].query).toEqual({ email: 'a@b.com' });
        });
    });

    describe('integrations (HTTP / webhook-style)', () => {
        it('CRUD paths and create body', async () => {
            const api = makeApi();
            const body = {
                name: 'My webhook',
                type: 'http',
                http: {
                    url: 'https://hook.example.com',
                    method: 'POST',
                    triggers: { 'ticket-created': true },
                },
            };
            await api.listIntegrations({ type: 'http' });
            await api.getIntegration(9);
            await api.createIntegration(body);
            await api.updateIntegration(9, { name: 'renamed' });
            await api.deleteIntegration(9);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.gorgias.com/api/integrations'],
                ['GET', 'https://acme.gorgias.com/api/integrations/9'],
                ['POST', 'https://acme.gorgias.com/api/integrations'],
                ['PUT', 'https://acme.gorgias.com/api/integrations/9'],
                ['DELETE', 'https://acme.gorgias.com/api/integrations/9'],
            ]);
            expect(api._captured[2].body).toEqual(body);
            expect(api._captured[0].query).toEqual({ type: 'http' });
        });
    });

    describe('widgets', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            const body = {
                context: 'ticket',
                type: 'http',
                integration_id: 9,
                template: {
                    type: 'wrapper',
                    widgets: [
                        {
                            type: 'card',
                            title: 'Info',
                            widgets: [
                                { type: 'text', title: 'Status', path: 'status' },
                            ],
                        },
                    ],
                },
            };
            await api.listWidgets({ integration_id: 9 });
            await api.getWidget(4);
            await api.createWidget(body);
            await api.updateWidget(4, { order: 1 });
            await api.deleteWidget(4);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.gorgias.com/api/widgets'],
                ['GET', 'https://acme.gorgias.com/api/widgets/4'],
                ['POST', 'https://acme.gorgias.com/api/widgets'],
                ['PUT', 'https://acme.gorgias.com/api/widgets/4'],
                ['DELETE', 'https://acme.gorgias.com/api/widgets/4'],
            ]);
            expect(api._captured[2].body.template.type).toBe('wrapper');
        });
    });
});
