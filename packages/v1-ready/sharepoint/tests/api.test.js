const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example/redirect/microsoft-sharepoint',
        scope: 'offline_access User.Read Sites.Read.All',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { value: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'uploaded' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'patched' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('SharePoint Api', () => {
    describe('construction & auth', () => {
        it('sets the Graph base URL and tenant token endpoints', () => {
            const api = new Api({
                client_id: 'c',
                tenant_id: 'contoso.onmicrosoft.com',
            });
            expect(api.baseUrl).toBe('https://graph.microsoft.com/v1.0');
            expect(api.authorizationUri).toContain(
                'login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize'
            );
            expect(api.tokenUri).toContain(
                'login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/token'
            );
        });

        it('defaults tenant_id to common', () => {
            const api = new Api({});
            expect(api.tenant_id).toBe('common');
        });

        it('getAuthUri includes OAuth2 authorize query params', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/r',
                scope: 'User.Read Sites.Read.All',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('redirect_uri=');
            expect(uri).toContain('scope=');
            expect(uri).toContain('state=xyz');
            expect(uri).toContain('prompt=select_account');
        });
    });

    describe('identity', () => {
        it('getUser hits GET /me', async () => {
            const api = makeApi();
            await api.getUser();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me'
            );
        });

        it('getOrganization hits GET /organization and returns first value', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api._captured.push({ method: 'GET', ...options });
                return { value: [{ id: 'org-1', displayName: 'Contoso' }] };
            };
            const org = await api.getOrganization();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/organization'
            );
            expect(org.id).toBe('org-1');
        });
    });

    describe('sites', () => {
        it('listSites defaults search to *', async () => {
            const api = makeApi();
            await api.listSites();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/sites?search=*'
            );
        });

        it('listSites forwards a custom search', async () => {
            const api = makeApi();
            await api.listSites({ search: 'hr' });
            expect(api._captured[0].url).toContain('search=hr');
        });

        it('getSite hits /sites/{id}', async () => {
            const api = makeApi();
            await api.getSite('site-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/sites/site-1'
            );
        });
    });

    describe('drives & drive items', () => {
        it('listDrives hits /sites/{id}/drives', async () => {
            const api = makeApi();
            await api.listDrives('site-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/sites/site-1/drives'
            );
        });

        it('getDrive hits /drives/{id}', async () => {
            const api = makeApi();
            await api.getDrive('drive-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/drive-1'
            );
        });

        it('listDriveItemChildren defaults itemId to root', async () => {
            const api = makeApi();
            await api.listDriveItemChildren('drive-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/drive-1/items/root/children'
            );
        });

        it('getDriveItem hits the item path', async () => {
            const api = makeApi();
            await api.getDriveItem('drive-1', 'item-9');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/drive-1/items/item-9'
            );
        });

        it('uploadDriveItemContent PUTs binary to the path URL', async () => {
            const api = makeApi();
            await api.uploadDriveItemContent(
                'drive-1',
                'root',
                'notes.txt',
                'hello',
                'text/plain'
            );
            const cap = api._captured[0];
            expect(cap.method).toBe('PUT');
            expect(cap.url).toBe(
                'https://graph.microsoft.com/v1.0/drives/drive-1/items/root:/notes.txt:/content'
            );
            expect(cap.headers['Content-Type']).toBe('text/plain');
            expect(cap.body).toBe('hello');
        });

        it('updateDriveItem PATCHes metadata', async () => {
            const api = makeApi();
            await api.updateDriveItem('drive-1', 'item-9', {
                name: 'renamed.docx',
            });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/drive-1/items/item-9'
            );
            expect(api._captured[0].body).toEqual({ name: 'renamed.docx' });
        });

        it('createUploadSession POSTs a session body', async () => {
            const api = makeApi();
            await api.createUploadSession('drive-1', 'root', 'big.bin');
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain(
                '/drives/drive-1/items/root:/big.bin:/createUploadSession'
            );
            expect(api._captured[0].body).toEqual({
                item: { name: 'big.bin' },
            });
        });
    });

    describe('lists & list items', () => {
        it('listLists / getList hit the list paths', async () => {
            const api = makeApi();
            await api.listLists('site-1');
            await api.getList('site-1', 'list-2');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/sites/site-1/lists'
            );
            expect(api._captured[1].url).toBe(
                'https://graph.microsoft.com/v1.0/sites/site-1/lists/list-2'
            );
        });

        it('listListItems / getListItem / createListItem / updateListItemFields', async () => {
            const api = makeApi();
            await api.listListItems('s', 'l');
            await api.getListItem('s', 'l', 'i');
            await api.createListItem('s', 'l', { fields: { Title: 'T' } });
            await api.updateListItemFields('s', 'l', 'i', { Title: 'U' });
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/sites/s/lists/l/items'
            );
            expect(api._captured[1].url).toBe(
                'https://graph.microsoft.com/v1.0/sites/s/lists/l/items/i'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].body).toEqual({ fields: { Title: 'T' } });
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[3].url).toContain('/items/i/fields');
            expect(api._captured[3].body).toEqual({ Title: 'U' });
        });
    });

    describe('subscriptions', () => {
        it('CRUD hits /subscriptions paths', async () => {
            const api = makeApi();
            await api.listSubscriptions();
            await api.getSubscription('sub-1');
            await api.createSubscription({
                changeType: 'updated',
                notificationUrl: 'https://hook.example/webhooks',
                resource: '/sites/s/lists/l',
                expirationDateTime: '2026-01-01T00:00:00Z',
            });
            await api.updateSubscription('sub-1', {
                expirationDateTime: '2026-02-01T00:00:00Z',
            });
            await api.deleteSubscription('sub-1');

            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions'
            );
            expect(api._captured[1].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions/sub-1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });
});
