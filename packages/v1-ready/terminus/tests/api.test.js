const { Api } = require('../api');

// Fully offline: stub _get/_post and assert on the request options the API
// methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { folders: [], lists: [], nextPageToken: '' };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    return api;
}

describe('Terminus Api', () => {
    describe('construction & auth', () => {
        it('sets the Account Lists v2 base URL and Bearer Authorization', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe(
                'https://api.terminusplatform.com/accountLists/v2'
            );
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_token).toBe('abc');
            expect(api.api_key).toBe('Bearer abc');
        });

        it('accepts api_token and strips a pre-existing Bearer prefix', () => {
            const api = new Api({ api_token: 'Bearer from-token' });
            expect(api.api_token).toBe('from-token');
            expect(api.api_key).toBe('Bearer from-token');
        });

        it('accepts access_token as an alias', () => {
            const api = new Api({ access_token: 'alias-key' });
            expect(api.api_token).toBe('alias-key');
        });

        it('adds the Authorization Bearer auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('setApiKey updates the raw token and Bearer header value', () => {
            const api = new Api({});
            api.setApiKey('Bearer new-key');
            expect(api.api_token).toBe('new-key');
            expect(api.api_key).toBe('Bearer new-key');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('listFolders', () => {
        it('hits GET /folders', async () => {
            const api = makeApi();
            await api.listFolders();
            expect(api._captured[0].url).toBe(
                'https://api.terminusplatform.com/accountLists/v2/folders'
            );
            expect(api._captured[0].method).toBe('GET');
        });
    });

    describe('createFolder', () => {
        it('POSTs to /folders with the body', async () => {
            const api = makeApi();
            const body = { folderName: 'Unit Testing', folderAccess: 'PUBLIC' };
            await api.createFolder(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.terminusplatform.com/accountLists/v2/folders'
            );
            expect(captured.body).toEqual(body);
        });
    });

    describe('listAccountLists', () => {
        it('hits GET /accountLists', async () => {
            const api = makeApi();
            await api.listAccountLists();
            expect(api._captured[0].url).toBe(
                'https://api.terminusplatform.com/accountLists/v2/accountLists'
            );
        });
    });

    describe('createAccountList', () => {
        it('POSTs to /accountLists with the body', async () => {
            const api = makeApi();
            const body = {
                listName: 'Unit test list',
                folderId: 'folder-1',
            };
            await api.createAccountList(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.terminusplatform.com/accountLists/v2/accountLists'
            );
            expect(captured.body).toEqual(body);
        });
    });

    describe('addAccountsToList', () => {
        it('POSTs to /accountLists/{listId}/accounts/add', async () => {
            const api = makeApi();
            const body = { accounts: [{ id: '001xx' }] };
            await api.addAccountsToList('list-9', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.terminusplatform.com/accountLists/v2/accountLists/list-9/accounts/add'
            );
            expect(captured.body).toEqual(body);
        });
    });

    describe('removeAccountsFromList', () => {
        it('POSTs to /accountLists/{listId}/accounts/remove', async () => {
            const api = makeApi();
            const body = { accounts: [{ id: '001xx' }] };
            await api.removeAccountsFromList('list-9', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.terminusplatform.com/accountLists/v2/accountLists/list-9/accounts/remove'
            );
            expect(captured.body).toEqual(body);
        });
    });

    describe('testAuth', () => {
        it('delegates to listFolders', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api._captured[0].url).toContain('/folders');
        });
    });
});
