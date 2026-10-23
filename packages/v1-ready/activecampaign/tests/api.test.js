const { Api, DEFAULT_BASE_URL } = require('../api');

// Fully offline: stub _get/_post/_put/_delete and assert on constructed options.
function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-key',
        api_url: 'https://demo.api-us1.com',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { contacts: [], meta: { total: '0' } };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: '1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: '1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('ActiveCampaign Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the OpenAPI placeholder host + /api/3', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.api_key_name).toBe('Api-Token');
            expect(api.api_key).toBe('abc');
        });

        it('builds baseUrl from the Developer-tab api_url', () => {
            const api = new Api({
                api_key: 'k',
                api_url: 'https://acme.api-us1.com',
            });
            expect(api.baseUrl).toBe('https://acme.api-us1.com/api/3');
        });

        it('strips a trailing /api/3 from api_url if the caller already included it', () => {
            const api = new Api({
                api_key: 'k',
                api_url: 'https://acme.api-us1.com/api/3',
            });
            expect(api.baseUrl).toBe('https://acme.api-us1.com/api/3');
            expect(api.api_url).toBe('https://acme.api-us1.com');
        });

        it('accepts apiKey / access_token aliases', () => {
            expect(new Api({ apiKey: 'from-camel' }).api_key).toBe('from-camel');
            expect(new Api({ access_token: 'from-token' }).api_key).toBe(
                'from-token'
            );
        });

        it('adds the Api-Token auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers['Api-Token']).toBe('secret');
        });

        it('setApiUrl updates baseUrl', () => {
            const api = new Api({ api_key: 'k' });
            api.setApiUrl('https://eu.api-us1.com/');
            expect(api.api_url).toBe('https://eu.api-us1.com');
            expect(api.baseUrl).toBe('https://eu.api-us1.com/api/3');
        });
    });

    describe('identity', () => {
        it('getUser hits GET /users/me', async () => {
            const api = makeApi();
            await api.getUser();
            expect(api._captured[0].url).toBe(
                'https://demo.api-us1.com/api/3/users/me'
            );
        });
    });

    describe('contacts', () => {
        it('listContacts hits GET /contacts with query', async () => {
            const api = makeApi();
            await api.listContacts({ email: 'a@b.com', limit: 50 });
            const { url, query } = api._captured[0];
            expect(url).toBe('https://demo.api-us1.com/api/3/contacts');
            expect(query).toEqual({ email: 'a@b.com', limit: 50 });
        });

        it('getContact / createContact / updateContact / deleteContact', async () => {
            const api = makeApi();
            await api.getContact(9);
            await api.createContact({
                contact: { email: 'x@y.com', firstName: 'X' },
            });
            await api.updateContact(9, { contact: { lastName: 'Y' } });
            await api.deleteContact(9);

            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://demo.api-us1.com/api/3/contacts/9',
            });
            expect(api._captured[1]).toMatchObject({
                method: 'POST',
                url: 'https://demo.api-us1.com/api/3/contacts',
                body: { contact: { email: 'x@y.com', firstName: 'X' } },
            });
            expect(api._captured[2]).toMatchObject({
                method: 'PUT',
                url: 'https://demo.api-us1.com/api/3/contacts/9',
            });
            expect(api._captured[3]).toMatchObject({
                method: 'DELETE',
                url: 'https://demo.api-us1.com/api/3/contacts/9',
            });
        });

        it('bulkContactImport posts to /import/bulk_import', async () => {
            const api = makeApi();
            await api.bulkContactImport({ contacts: [] });
            expect(api._captured[0].url).toBe(
                'https://demo.api-us1.com/api/3/import/bulk_import'
            );
        });
    });

    describe('accounts', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listAccounts({ search: 'Acme' });
            await api.getAccount(3);
            await api.createAccount({ account: { name: 'Acme' } });
            await api.updateAccount(3, { account: { name: 'Acme Co' } });
            expect(api._captured[0].url).toBe(
                'https://demo.api-us1.com/api/3/accounts'
            );
            expect(api._captured[1].url).toBe(
                'https://demo.api-us1.com/api/3/accounts/3'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });

        it('bulkDeleteAccounts uses ids[] query params', async () => {
            const api = makeApi();
            await api.bulkDeleteAccounts([1, 2, 3]);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://demo.api-us1.com/api/3/accounts/bulk_delete?ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3'
            );
        });
    });

    describe('accountContacts', () => {
        it('list / get / create / update / delete', async () => {
            const api = makeApi();
            await api.listAccountContacts();
            await api.getAccountContact(4);
            await api.createAccountContact({
                accountContact: { account: 1, contact: 2 },
            });
            await api.updateAccountContact(4, {
                accountContact: { jobTitle: 'PM' },
            });
            await api.deleteAccountContact(4);
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[2].url).toBe(
                'https://demo.api-us1.com/api/3/accountContacts'
            );
        });
    });

    describe('tags', () => {
        it('list / create / delete + contactTag apply/remove', async () => {
            const api = makeApi();
            await api.listTags({ type: 'contact' });
            await api.createTag({
                tag: { tag: 'vip', tagType: 'contact' },
            });
            await api.deleteTag(7);
            await api.createContactTag({
                contactTag: { contact: 1, tag: 7 },
            });
            await api.deleteContactTag(99);
            expect(api._captured[0].url).toBe(
                'https://demo.api-us1.com/api/3/tags'
            );
            expect(api._captured[3].url).toBe(
                'https://demo.api-us1.com/api/3/contactTags'
            );
            expect(api._captured[4].url).toBe(
                'https://demo.api-us1.com/api/3/contactTags/99'
            );
        });
    });

    describe('webhooks', () => {
        it('list / get / create / update / delete', async () => {
            const api = makeApi();
            const body = {
                webhook: {
                    name: 'Hook',
                    url: 'https://hook.example.com',
                    events: ['subscribe'],
                    sources: ['api'],
                },
            };
            await api.listWebhooks();
            await api.getWebhook(5);
            await api.createWebhook(body);
            await api.updateWebhook(5, body);
            await api.deleteWebhook(5);
            expect(api._captured.map((c) => `${c.method} ${c.url}`)).toEqual([
                'GET https://demo.api-us1.com/api/3/webhooks',
                'GET https://demo.api-us1.com/api/3/webhooks/5',
                'POST https://demo.api-us1.com/api/3/webhooks',
                'PUT https://demo.api-us1.com/api/3/webhooks/5',
                'DELETE https://demo.api-us1.com/api/3/webhooks/5',
            ]);
            expect(api._captured[2].body).toEqual(body);
        });
    });
});
