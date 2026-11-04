const {
    Api,
    DEFAULT_BASE_URL,
    toFormBody,
    normalizeListQuery,
} = require('../api');

// Fully offline: stub _get/_post/_delete and assert on constructed options.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { responseCode: 200, content: [] };
    };
    api._post = async (options, stringify) => {
        api._captured.push({
            method: 'POST',
            stringify,
            ...options,
        });
        return { responseCode: 200, content: {} };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { responseCode: 200, content: {} };
    };
    return api;
}

describe('Jotform Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the US host and APIKEY header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.baseUrl).toBe('https://api.jotform.com');
            expect(api.api_key_name).toBe('APIKEY');
            expect(api.api_key).toBe('abc');
        });

        it('accepts EU / HIPAA / custom base_url', () => {
            expect(
                new Api({
                    api_key: 'k',
                    base_url: 'https://eu-api.jotform.com/',
                }).baseUrl
            ).toBe('https://eu-api.jotform.com');
            expect(
                new Api({
                    api_key: 'k',
                    baseUrl: 'https://hipaa-api.jotform.com',
                }).baseUrl
            ).toBe('https://hipaa-api.jotform.com');
        });

        it('accepts apiKey / access_token aliases', () => {
            expect(new Api({ apiKey: 'from-camel' }).api_key).toBe(
                'from-camel'
            );
            expect(new Api({ access_token: 'from-token' }).api_key).toBe(
                'from-token'
            );
        });

        it('adds the APIKEY auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.APIKEY).toBe('secret');
        });

        it('setBaseUrl updates baseUrl', () => {
            const api = new Api({ api_key: 'k' });
            api.setBaseUrl('https://eu-api.jotform.com/');
            expect(api.baseUrl).toBe('https://eu-api.jotform.com');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('form encoding helpers', () => {
        it('flattens nested submission fields to bracket notation', () => {
            expect(toFormBody({ submission: { 1: 'a@b.com', 2: 'Hi' } })).toBe(
                'submission%5B1%5D=a%40b.com&submission%5B2%5D=Hi'
            );
        });

        it('JSON.stringifies object filters', () => {
            expect(
                normalizeListQuery({
                    limit: 20,
                    filter: { 'created_at:gt': '2024-01-01 00:00:00' },
                })
            ).toEqual({
                limit: 20,
                filter: '{"created_at:gt":"2024-01-01 00:00:00"}',
            });
        });
    });

    describe('identity', () => {
        it('getUser hits GET /user', async () => {
            const api = makeApi();
            await api.getUser();
            expect(api._captured[0].url).toBe('https://api.jotform.com/user');
        });
    });

    describe('forms', () => {
        it('listForms hits GET /user/forms with query', async () => {
            const api = makeApi();
            await api.listForms({ limit: 10, offset: 0 });
            expect(api._captured[0].url).toBe(
                'https://api.jotform.com/user/forms'
            );
            expect(api._captured[0].query).toEqual({ limit: 10, offset: 0 });
        });

        it('getForm / createForm / deleteForm / updateFormProperties', async () => {
            const api = makeApi();
            await api.getForm('123');
            await api.createForm({
                properties: { title: 'Contact' },
                questions: {
                    1: { type: 'control_email', text: 'Email', order: '1' },
                },
            });
            await api.updateFormProperties('123', { title: 'Updated' });
            await api.deleteForm('123');

            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.jotform.com/form/123',
            });
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe('https://api.jotform.com/form');
            expect(api._captured[1].stringify).toBe(false);
            expect(api._captured[1].headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(api._captured[1].body).toContain('properties%5Btitle%5D=Contact');
            expect(api._captured[2].url).toBe(
                'https://api.jotform.com/form/123/properties'
            );
            expect(api._captured[2].body).toContain(
                'properties%5Btitle%5D=Updated'
            );
            expect(api._captured[3]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.jotform.com/form/123',
            });
        });

        it('listFormQuestions hits GET /form/{id}/questions', async () => {
            const api = makeApi();
            await api.listFormQuestions('99');
            expect(api._captured[0].url).toBe(
                'https://api.jotform.com/form/99/questions'
            );
        });
    });

    describe('submissions', () => {
        it('list / get / create / update / delete', async () => {
            const api = makeApi();
            await api.listFormSubmissions('123', { limit: 5 });
            await api.listUserSubmissions({ offset: 10 });
            await api.getSubmission('sid-1');
            await api.createFormSubmission('123', { 1: 'hello' });
            await api.updateSubmission('sid-1', { 1: 'updated' });
            await api.deleteSubmission('sid-1');

            expect(api._captured[0].url).toBe(
                'https://api.jotform.com/form/123/submissions'
            );
            expect(api._captured[0].query).toEqual({ limit: 5 });
            expect(api._captured[1].url).toBe(
                'https://api.jotform.com/user/submissions'
            );
            expect(api._captured[2].url).toBe(
                'https://api.jotform.com/submission/sid-1'
            );
            expect(api._captured[3].method).toBe('POST');
            expect(api._captured[3].body).toContain('submission%5B1%5D=hello');
            expect(api._captured[4].url).toBe(
                'https://api.jotform.com/submission/sid-1'
            );
            expect(api._captured[5].method).toBe('DELETE');
        });
    });

    describe('webhooks', () => {
        it('list / create / delete', async () => {
            const api = makeApi();
            await api.listFormWebhooks('123');
            await api.createFormWebhook('123', 'https://hook.example.com');
            await api.deleteFormWebhook('123', '0');

            expect(api._captured.map((c) => `${c.method} ${c.url}`)).toEqual([
                'GET https://api.jotform.com/form/123/webhooks',
                'POST https://api.jotform.com/form/123/webhooks',
                'DELETE https://api.jotform.com/form/123/webhooks/0',
            ]);
            expect(api._captured[1].body).toBe(
                'webhookURL=https%3A%2F%2Fhook.example.com'
            );
            expect(api._captured[1].stringify).toBe(false);
        });
    });
});
