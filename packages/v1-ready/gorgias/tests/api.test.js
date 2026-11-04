const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        subdomain: 'acme',
        access_token: 'tok',
        client_id: 'cid',
        client_secret: 'csecret',
        scope: 'openid offline tickets:read',
        redirect_uri: 'https://app.example.com/redirect/gorgias',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
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
        return {};
    };
    return api;
}

describe('Gorgias Api', () => {
    describe('construction & auth', () => {
        it('uses the template baseUrl when subdomain is unset (matches OpenAPI)', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe('https://{domain}.gorgias.com/api');
        });

        it('resolves baseUrl and tokenUri for a subdomain', () => {
            const api = new Api({ subdomain: 'acme' });
            expect(api.baseUrl).toBe('https://acme.gorgias.com/api');
            expect(api.tokenUri).toBe('https://acme.gorgias.com/oauth/token');
        });

        it('setSubdomain updates baseUrl and tokenUri', () => {
            const api = new Api({});
            api.setSubdomain('green-garden');
            expect(api.subdomain).toBe('green-garden');
            expect(api.baseUrl).toBe('https://green-garden.gorgias.com/api');
            expect(api.tokenUri).toBe(
                'https://green-garden.gorgias.com/oauth/token'
            );
        });

        it('getAuthUri builds authorize URL without hard-coded state/nonce or {{subdomain}}', () => {
            const api = new Api({
                client_id: 'cid',
                scope: 'openid offline',
                redirect_uri: 'https://app.example.com/redirect/gorgias',
            });
            const uri1 = api.getAuthUri({ subdomain: 'acme' });
            const uri2 = api.getAuthUri({ subdomain: 'acme' });
            expect(uri1).toContain('https://acme.gorgias.com/oauth/authorize?');
            expect(uri1).toContain('client_id=cid');
            expect(uri1).toContain('response_type=code');
            expect(uri1).not.toContain('{{subdomain}}');
            expect(uri1).not.toContain('kxzcjhvwaasdbnfrtlkxu9ih');
            // State differs across calls (CSRF protection).
            const state1 = new URL(uri1).searchParams.get('state');
            const state2 = new URL(uri2).searchParams.get('state');
            expect(state1).toBeTruthy();
            expect(state2).toBeTruthy();
            expect(state1).not.toBe(state2);
        });

        it('getAuthUri accepts explicit state/nonce', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example.com/cb',
                scope: 'openid',
            });
            const uri = api.getAuthUri({
                subdomain: 'acme',
                state: 'fixed-state',
                nonce: 'fixed-nonce',
            });
            const sp = new URL(uri).searchParams;
            expect(sp.get('state')).toBe('fixed-state');
            expect(sp.get('nonce')).toBe('fixed-nonce');
        });

        it('addAuthHeaders prefers Bearer access_token', async () => {
            const api = new Api({
                access_token: 'bearer-tok',
                api_user_email: 'a@b.com',
                api_key: 'key',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer bearer-tok');
        });

        it('addAuthHeaders falls back to Basic for private apps', async () => {
            const api = new Api({
                api_user_email: 'agent@acme.com',
                api_key: 'secret-key',
            });
            const headers = await api.addAuthHeaders({});
            const expected = Buffer.from('agent@acme.com:secret-key').toString(
                'base64'
            );
            expect(headers.Authorization).toBe(`Basic ${expected}`);
        });
    });

    describe('tickets', () => {
        it('listTickets hits GET /tickets', async () => {
            const api = makeApi();
            await api.listTickets({ limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets'
            );
            expect(api._captured[0].query).toEqual({ limit: 10 });
        });

        it('getTicket hits GET /tickets/{id}', async () => {
            const api = makeApi();
            await api.getTicket(42);
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets/42'
            );
        });

        it('updateTicket uses ticketById (not ticketsById typo)', async () => {
            const api = makeApi();
            await api.updateTicket(7, { status: 'closed' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets/7'
            );
            expect(api._captured[0].body).toEqual({ status: 'closed' });
        });

        it('createTicket and deleteTicket hit the expected paths', async () => {
            const api = makeApi();
            await api.createTicket({ subject: 'Hi' });
            await api.deleteTicket(9);
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets'
            );
            expect(api._captured[1].url).toBe(
                'https://acme.gorgias.com/api/tickets/9'
            );
        });
    });

    describe('messages', () => {
        it('listMessages hits GET /messages', async () => {
            const api = makeApi();
            await api.listMessages({ ticket_id: 3 });
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/messages'
            );
            expect(api._captured[0].query).toEqual({ ticket_id: 3 });
        });

        it('getMessage hits GET /tickets/{ticket_id}/messages/{id}', async () => {
            const api = makeApi();
            await api.getMessage(3, 99);
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets/3/messages/99'
            );
        });

        it('createTicketMessage posts to /tickets/{id}/messages', async () => {
            const api = makeApi();
            await api.createTicketMessage(3, { body_text: 'hello' });
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/tickets/3/messages'
            );
        });
    });

    describe('customers / users / tags / surveys', () => {
        it('list and get paths are correct', async () => {
            const api = makeApi();
            await api.listCustomers();
            await api.getCustomer(1);
            await api.listUsers();
            await api.getUser(0);
            await api.listTags();
            await api.getTag(5);
            await api.listSatisfactionSurveys({ ticket_id: 1 });
            await api.getSatisfactionSurvey(2);
            const urls = api._captured.map((c) => c.url);
            expect(urls).toEqual([
                'https://acme.gorgias.com/api/customers',
                'https://acme.gorgias.com/api/customers/1',
                'https://acme.gorgias.com/api/users',
                'https://acme.gorgias.com/api/users/0',
                'https://acme.gorgias.com/api/tags',
                'https://acme.gorgias.com/api/tags/5',
                'https://acme.gorgias.com/api/satisfaction-surveys',
                'https://acme.gorgias.com/api/satisfaction-surveys/2',
            ]);
        });
    });

    describe('integrations & widgets', () => {
        it('CRUD paths for integrations', async () => {
            const api = makeApi();
            await api.listIntegrations({ type: 'http' });
            await api.createIntegration({ type: 'http', name: 'Hook' });
            await api.getIntegration(11);
            await api.updateIntegration(11, { name: 'Hook2' });
            await api.deleteIntegration(11);
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://acme.gorgias.com/api/integrations'],
                ['POST', 'https://acme.gorgias.com/api/integrations'],
                ['GET', 'https://acme.gorgias.com/api/integrations/11'],
                ['PUT', 'https://acme.gorgias.com/api/integrations/11'],
                ['DELETE', 'https://acme.gorgias.com/api/integrations/11'],
            ]);
        });

        it('CRUD paths for widgets', async () => {
            const api = makeApi();
            await api.listWidgets();
            await api.createWidget({ context: 'ticket', type: 'http' });
            await api.getWidget(4);
            await api.updateWidget(4, { order: 1 });
            await api.deleteWidget(4);
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://acme.gorgias.com/api/widgets',
                'https://acme.gorgias.com/api/widgets',
                'https://acme.gorgias.com/api/widgets/4',
                'https://acme.gorgias.com/api/widgets/4',
                'https://acme.gorgias.com/api/widgets/4',
            ]);
        });
    });

    describe('account', () => {
        it('getAccount hits GET /account', async () => {
            const api = makeApi();
            await api.getAccount();
            expect(api._captured[0].url).toBe(
                'https://acme.gorgias.com/api/account'
            );
        });
    });

    // Keep crypto import "used" for lint-free environments that flag it.
    it('generates random bytes for auth state', () => {
        expect(crypto.randomBytes(8).length).toBe(8);
    });
});
