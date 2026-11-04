const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    const capture =
        (method) =>
        async (options) => {
            api._captured.push({ method, ...options });
            return { ok: true };
        };
    api._get = capture('GET');
    api._post = capture('POST');
    api._patch = capture('PATCH');
    api._put = capture('PUT');
    api._delete = capture('DELETE');
    return api;
}

describe('FastSpring IQ Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and api_key header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api-iq.fastspring.com');
            expect(api.api_key_name).toBe('api_key');
            expect(api.api_key).toBe('abc');
        });

        it('accepts apiKey and access_token aliases', () => {
            expect(new Api({ apiKey: 'from-apiKey' }).api_key).toBe(
                'from-apiKey'
            );
            expect(new Api({ access_token: 'from-token' }).api_key).toBe(
                'from-token'
            );
        });

        it('adds the api_key auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.api_key).toBe('secret');
        });

        it('exposes an apiKey authorization form', () => {
            const reqs = new Api({}).getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toContain('api_key');
        });
    });

    describe('identity', () => {
        it('getMyOrganization hits GET /my-organization', async () => {
            const api = makeApi();
            await api.getMyOrganization();
            expect(api._captured[0].url).toBe(
                'https://api-iq.fastspring.com/my-organization'
            );
        });

        it('rotateApiKey POSTs /auth/rotatekey', async () => {
            const api = makeApi();
            await api.rotateApiKey({});
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api-iq.fastspring.com/auth/rotatekey'
            );
        });
    });

    describe('quotes', () => {
        it('listQuotes hits GET /quotes/', async () => {
            const api = makeApi();
            await api.listQuotes({ includes: 'summary' });
            expect(api._captured[0].url).toBe(
                'https://api-iq.fastspring.com/quotes/'
            );
            expect(api._captured[0].query).toEqual({ includes: 'summary' });
        });

        it('searchQuotes forwards query params', async () => {
            const api = makeApi();
            await api.searchQuotes({
                query: 'Acme',
                contactEmail: 'a@b.com',
            });
            expect(api._captured[0].url).toBe(
                'https://api-iq.fastspring.com/quotes/search'
            );
            expect(api._captured[0].query.query).toBe('Acme');
        });

        it('getQuote / updateQuote / createQuote hit the quote paths', async () => {
            const api = makeApi();
            await api.getQuote('q1');
            await api.updateQuote('q1', { title: 'T' });
            await api.createQuote({ title: 'New' });
            expect(api._captured[0].url).toBe(
                'https://api-iq.fastspring.com/quotes/q1'
            );
            expect(api._captured[1].method).toBe('PATCH');
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://api-iq.fastspring.com/quotes/'
            );
        });

        it('lifecycle helpers hit closed-won/lost/publish/unpublish/copy', async () => {
            const api = makeApi();
            await api.setQuoteClosedWon('q1');
            await api.setQuoteClosedLost('q1');
            await api.publishQuote('q1');
            await api.unpublishQuote('q1');
            await api.copyQuote('q1', { title: 'Copy' });
            const urls = api._captured.map((c) => c.url);
            expect(urls).toEqual([
                'https://api-iq.fastspring.com/quotes/q1/closed-won',
                'https://api-iq.fastspring.com/quotes/q1/closed-lost',
                'https://api-iq.fastspring.com/quotes/q1/publish',
                'https://api-iq.fastspring.com/quotes/q1/unpublish',
                'https://api-iq.fastspring.com/quotes/copy/q1',
            ]);
        });

        it('getQuoteBreakdown can request HTML', async () => {
            const api = makeApi();
            await api.getQuoteBreakdown('q1', { asHtml: true });
            expect(api._captured[0].headers['Content-Type']).toBe('text/html');
        });
    });

    describe('companies / contacts / activities', () => {
        it('CRUD paths for companies', async () => {
            const api = makeApi();
            await api.listCompanies();
            await api.getCompany('c1');
            await api.createCompany({ name: 'Acme' });
            await api.updateCompany('c1', { name: 'Acme2' });
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://api-iq.fastspring.com/companies/'],
                ['GET', 'https://api-iq.fastspring.com/companies/c1'],
                ['POST', 'https://api-iq.fastspring.com/companies/'],
                ['PUT', 'https://api-iq.fastspring.com/companies/c1'],
            ]);
        });

        it('CRUD paths for contacts including delete', async () => {
            const api = makeApi();
            await api.listContacts({ companyId: 'c1' });
            await api.getContact('ct1');
            await api.createContact({
                companyId: 'c1',
                email: 'a@b.com',
                firstName: 'A',
                lastName: 'B',
            });
            await api.updateContact('ct1', { firstName: 'Z' });
            await api.deleteContact('ct1');
            expect(api._captured[0].query).toEqual({ companyId: 'c1' });
            expect(api._captured[4].method).toBe('DELETE');
        });

        it('list/get/create activities', async () => {
            const api = makeApi();
            await api.listActivities();
            await api.getActivity('a1');
            await api.createActivity({ type: 'comment', quoteId: 'q1' });
            expect(api._captured[2].url).toBe(
                'https://api-iq.fastspring.com/activities/'
            );
        });
    });

    describe('webhooks', () => {
        it('list/get/create/update/delete webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks();
            await api.getWebhook('w1');
            await api.createWebhook({
                url: 'https://hook.example.com',
                topic: 'quotes/create',
                method: 'POST',
            });
            await api.updateWebhook('w1', { topic: 'quotes/*' });
            await api.deleteWebhook('w1');
            expect(api._captured[2].body.topic).toBe('quotes/create');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('templates & published quotes', () => {
        it('template paths', async () => {
            const api = makeApi();
            await api.listTemplates();
            await api.searchTemplates({ query: 'Widgets' });
            await api.getTemplate('t1');
            await api.createTemplate({ title: 'T' });
            await api.updateTemplate('t1', { isActive: true });
            expect(api._captured[1].url).toBe(
                'https://api-iq.fastspring.com/templates/search'
            );
        });

        it('published quote paths', async () => {
            const api = makeApi();
            await api.listPublishedQuotes();
            await api.getPublishedQuote('pq1');
            await api.getPublishedQuoteAnalytics('pq1');
            await api.getPublishedQuoteBreakdown('pq1');
            expect(api._captured[2].url).toBe(
                'https://api-iq.fastspring.com/published-quotes/pq1/analytics'
            );
        });
    });
});
