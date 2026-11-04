const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'tf-client',
        client_secret: 'tf-secret',
        redirect_uri: 'https://example.com/redirect/typeform',
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
        return { id: 'form1' };
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

describe('Typeform Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to api.typeform.com', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://api.typeform.com');
            expect(api.tokenUri).toBe('https://api.typeform.com/oauth/token');
        });

        it('builds an authorize URL with client_id, scope, and redirect_uri', () => {
            const api = new Api({
                client_id: 'cid-1',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/typeform',
                scope: 'offline forms:read',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://api.typeform.com/oauth/authorize?'
            );
            expect(uri).toContain('client_id=cid-1');
            expect(uri).toContain('scope=offline+forms%3Aread');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Ftypeform'
            );
            expect(uri).toContain('state=xyz');
        });

        it('accepts TYPEFORM_BASE_URL / base_url override for EU', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
                base_url: 'https://api.eu.typeform.com',
            });
            expect(api.baseUrl).toBe('https://api.eu.typeform.com');
            expect(api.tokenUri).toBe(
                'https://api.eu.typeform.com/oauth/token'
            );
        });
    });

    describe('getMe', () => {
        it('hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe(
                'https://api.typeform.com/me'
            );
        });

        it('getUserDetails aliases getMe', async () => {
            const api = makeApi();
            await api.getUserDetails();
            expect(api._captured[0].url).toBe(
                'https://api.typeform.com/me'
            );
        });
    });

    describe('forms', () => {
        it('listForms hits GET /forms with query', async () => {
            const api = makeApi();
            await api.listForms({ page: 2, page_size: 50, search: 'nps' });
            const call = api._captured[0];
            expect(call.url).toBe('https://api.typeform.com/forms');
            expect(call.query).toEqual({
                page: 2,
                page_size: 50,
                search: 'nps',
            });
        });

        it('getForm hits GET /forms/{id}', async () => {
            const api = makeApi();
            await api.getForm('u6nXL7');
            expect(api._captured[0].url).toBe(
                'https://api.typeform.com/forms/u6nXL7'
            );
        });

        it('createForm POSTs JSON body', async () => {
            const api = makeApi();
            const body = { title: 'Hello', fields: [] };
            await api.createForm(body);
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe('https://api.typeform.com/forms');
            expect(call.body).toEqual(body);
        });

        it('updateForm PUTs to /forms/{id}', async () => {
            const api = makeApi();
            const body = { title: 'Updated' };
            await api.updateForm('abc', body);
            const call = api._captured[0];
            expect(call.method).toBe('PUT');
            expect(call.url).toBe('https://api.typeform.com/forms/abc');
            expect(call.body).toEqual(body);
        });

        it('deleteForm DELETEs /forms/{id}', async () => {
            const api = makeApi();
            await api.deleteForm('abc');
            expect(api._captured[0]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.typeform.com/forms/abc',
            });
        });
    });

    describe('listResponses', () => {
        it('hits GET /forms/{id}/responses with query', async () => {
            const api = makeApi();
            await api.listResponses('f1', {
                page_size: 10,
                response_type: 'completed',
            });
            const call = api._captured[0];
            expect(call.url).toBe(
                'https://api.typeform.com/forms/f1/responses'
            );
            expect(call.query.page_size).toBe(10);
            expect(call.query.response_type).toBe('completed');
        });
    });

    describe('webhooks', () => {
        it('listWebhooks hits GET /forms/{id}/webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks('f1');
            expect(api._captured[0].url).toBe(
                'https://api.typeform.com/forms/f1/webhooks'
            );
        });

        it('getWebhook hits GET /forms/{id}/webhooks/{tag}', async () => {
            const api = makeApi();
            await api.getWebhook('f1', 'phoenix');
            expect(api._captured[0].url).toBe(
                'https://api.typeform.com/forms/f1/webhooks/phoenix'
            );
        });

        it('createOrUpdateWebhook PUTs body to /webhooks/{tag}', async () => {
            const api = makeApi();
            const body = {
                url: 'https://hook.example.com',
                enabled: true,
                event_types: { form_response: true },
            };
            await api.createOrUpdateWebhook('f1', 'phoenix', body);
            const call = api._captured[0];
            expect(call.method).toBe('PUT');
            expect(call.url).toBe(
                'https://api.typeform.com/forms/f1/webhooks/phoenix'
            );
            expect(call.body).toEqual(body);
        });

        it('deleteWebhook DELETEs /webhooks/{tag}', async () => {
            const api = makeApi();
            await api.deleteWebhook('f1', 'phoenix');
            expect(api._captured[0]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.typeform.com/forms/f1/webhooks/phoenix',
            });
        });
    });
});
