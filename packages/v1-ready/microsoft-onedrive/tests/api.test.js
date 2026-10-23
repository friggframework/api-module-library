const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example/redirect/microsoft-onedrive',
        scope: 'offline_access User.Read Files.ReadWrite',
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

describe('OneDrive Api', () => {
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
                scope: 'User.Read Files.ReadWrite',
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

    describe('identity & drives', () => {
        it('getUser hits GET /me', async () => {
            const api = makeApi();
            await api.getUser();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me'
            );
        });

        it('getMyDrive hits GET /me/drive', async () => {
            const api = makeApi();
            await api.getMyDrive();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/drive'
            );
        });

        it('listMyDrives hits GET /me/drives', async () => {
            const api = makeApi();
            await api.listMyDrives();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/drives'
            );
        });

        it('getDrive hits /drives/{id}', async () => {
            const api = makeApi();
            await api.getDrive('drive-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/drive-1'
            );
        });
    });

    describe('drive items', () => {
        it('listDriveItemChildren defaults itemId to root', async () => {
            const api = makeApi();
            await api.listDriveItemChildren('d1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/root/children'
            );
        });

        it('getDriveItem hits item path', async () => {
            const api = makeApi();
            await api.getDriveItem('d1', 'item-9');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/item-9'
            );
        });

        it('createFolder POSTs to children with body', async () => {
            const api = makeApi();
            const body = {
                name: 'New Folder',
                folder: {},
                '@microsoft.graph.conflictBehavior': 'rename',
            };
            await api.createFolder('d1', 'root', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/root/children'
            );
            expect(captured.body).toEqual(body);
        });

        it('createFolder accepts optional conflictBehavior as 4th arg', async () => {
            const api = makeApi();
            await api.createFolder(
                'd1',
                'root',
                { name: 'Docs', folder: {} },
                'fail'
            );
            expect(api._captured[0].body).toEqual({
                name: 'Docs',
                folder: {},
                '@microsoft.graph.conflictBehavior': 'fail',
            });
        });

        it('updateDriveItem PATCHes metadata', async () => {
            const api = makeApi();
            await api.updateDriveItem('d1', 'item-1', { name: 'renamed.docx' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/item-1'
            );
            expect(api._captured[0].body).toEqual({ name: 'renamed.docx' });
        });

        it('deleteDriveItem DELETEs the item', async () => {
            const api = makeApi();
            await api.deleteDriveItem('d1', 'item-1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/item-1'
            );
        });

        it('uploadDriveItemContent PUTs binary content by driveItem-id', async () => {
            const api = makeApi();
            await api.uploadDriveItemContent(
                'd1',
                'root:/hello.txt:',
                Buffer.from('hi'),
                'text/plain'
            );
            const captured = api._captured[0];
            expect(captured.method).toBe('PUT');
            expect(captured.url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/root:/hello.txt:/content'
            );
            expect(captured.headers['Content-Type']).toBe('text/plain');
        });

        it('createUploadSession POSTs required session body', async () => {
            const api = makeApi();
            const body = { item: { name: 'big.bin' } };
            await api.createUploadSession('d1', 'root:/big.bin:', body);
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/items/root:/big.bin:/createUploadSession'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('searchDriveItems uses official /search(q=...) path and escapes quotes', async () => {
            const api = makeApi();
            await api.searchDriveItems('d1', "O'Brien");
            expect(api._captured[0].url).toBe(
                "https://graph.microsoft.com/v1.0/drives/d1/search(q='O''Brien')"
            );
        });

        it('uploadByPath PUTs to Learn root:/{path}:/content', async () => {
            const api = makeApi();
            await api.uploadByPath(
                'd1',
                'folder/hello.txt',
                Buffer.from('hi'),
                'text/plain'
            );
            const captured = api._captured[0];
            expect(captured.method).toBe('PUT');
            expect(captured.url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/root:/folder/hello.txt:/content'
            );
            expect(captured.headers['Content-Type']).toBe('text/plain');
        });

        it('uploadByPath encodes path segments', async () => {
            const api = makeApi();
            await api.uploadByPath('d1', 'My Docs/a b.txt', 'x');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/root:/My%20Docs/a%20b.txt:/content'
            );
        });

        it('createUploadSessionByPath POSTs to Learn root:/{path}:/createUploadSession', async () => {
            const api = makeApi();
            const body = { item: { name: 'big.bin' } };
            await api.createUploadSessionByPath('d1', 'folder/big.bin', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/drives/d1/root:/folder/big.bin:/createUploadSession'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('subscriptions', () => {
        it('listSubscriptions hits GET /subscriptions', async () => {
            const api = makeApi();
            await api.listSubscriptions();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions'
            );
        });

        it('createSubscription POSTs the body', async () => {
            const api = makeApi();
            const body = {
                changeType: 'updated',
                notificationUrl: 'https://hook.example/onedrive',
                resource: '/me/drive/root',
                expirationDateTime: '2026-10-21T00:00:00Z',
                clientState: 'secret',
            };
            await api.createSubscription(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('get/update/deleteSubscription hit subscription by id', async () => {
            const api = makeApi();
            await api.getSubscription('sub-1');
            await api.updateSubscription('sub-1', {
                expirationDateTime: '2026-10-22T00:00:00Z',
            });
            await api.deleteSubscription('sub-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions/sub-1'
            );
            expect(api._captured[1].method).toBe('PATCH');
            expect(api._captured[2].method).toBe('DELETE');
        });
    });
});
