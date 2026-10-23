const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'dbx-client',
        client_secret: 'app-secret',
        redirect_uri: 'https://example.com/redirect/dropbox',
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
        return { ok: true };
    };
    return api;
}

describe('Dropbox Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to api.dropboxapi.com/2 and content host', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://api.dropboxapi.com/2');
            expect(api.contentBaseUrl).toBe(
                'https://content.dropboxapi.com/2'
            );
            expect(api.tokenUri).toBe(
                'https://api.dropboxapi.com/oauth2/token'
            );
        });

        it('builds an authorize URL with offline token access', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/dropbox',
                scope: 'openid profile account_info.read files.metadata.read',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://www.dropbox.com/oauth2/authorize?'
            );
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('token_access_type=offline');
            expect(uri).toContain(
                'scope=openid+profile+account_info.read+files.metadata.read'
            );
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fdropbox'
            );
            expect(uri).toContain('state=xyz');
        });

        it('defaults include openid, files, and sharing.read scopes', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain('openid');
            expect(uri).toContain('sharing.read');
            expect(uri).toContain('files.content.write');
        });

        it('adds Bearer Authorization header', async () => {
            const api = new Api({
                access_token: 'tok-1',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-1');
        });
    });

    describe('users', () => {
        it('getUserDetails POSTs null to /openid/userinfo', async () => {
            const api = makeApi();
            await api.getUserDetails();
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/openid/userinfo'
            );
            expect(api._captured[0].body).toBeNull();
        });

        it('getCurrentAccount POSTs null to /users/get_current_account', async () => {
            const api = makeApi();
            await api.getCurrentAccount();
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/users/get_current_account'
            );
            expect(api._captured[0].body).toBeNull();
        });

        it('getSpaceUsage POSTs null to /users/get_space_usage', async () => {
            const api = makeApi();
            await api.getSpaceUsage();
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/users/get_space_usage'
            );
            expect(api._captured[0].body).toBeNull();
        });
    });

    describe('files metadata', () => {
        it('listFolder POSTs ListFolderArg with v1-compatible defaults', async () => {
            const api = makeApi();
            await api.listFolder({ limit: 100 });
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/files/list_folder'
            );
            expect(api._captured[0].body).toEqual({
                path: '',
                include_deleted: false,
                include_has_explicit_shared_members: false,
                include_mounted_folders: true,
                include_non_downloadable_files: true,
                recursive: false,
                limit: 100,
            });
        });

        it('listFolderContinue POSTs cursor object or string', async () => {
            const api = makeApi();
            await api.listFolderContinue({ cursor: 'cur-1' });
            await api.listFolderContinue('cur-2');
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/files/list_folder/continue'
            );
            expect(api._captured[0].body).toEqual({ cursor: 'cur-1' });
            expect(api._captured[1].body).toEqual({ cursor: 'cur-2' });
        });

        it('listSharedFolders POSTs to /sharing/list_folders', async () => {
            const api = makeApi();
            await api.listSharedFolders({});
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/sharing/list_folders'
            );
            expect(api._captured[0].body).toEqual({});
        });

        it('listSharedFoldersContinue accepts cursor string', async () => {
            const api = makeApi();
            await api.listSharedFoldersContinue('shared-cur');
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/sharing/list_folders/continue'
            );
            expect(api._captured[0].body).toEqual({ cursor: 'shared-cur' });
        });

        it('getMetadata POSTs path', async () => {
            const api = makeApi();
            await api.getMetadata({ path: '/Homework/math' });
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/files/get_metadata'
            );
            expect(api._captured[0].body).toEqual({ path: '/Homework/math' });
        });

        it('createFolderV2 POSTs CreateFolderArg', async () => {
            const api = makeApi();
            await api.createFolderV2({ path: '/Homework/math' });
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/files/create_folder_v2'
            );
        });

        it('deleteV2 / moveV2 / copyV2 hit the v2 routes', async () => {
            const api = makeApi();
            await api.deleteV2({ path: '/a' });
            await api.moveV2({ from_path: '/a', to_path: '/b' });
            await api.copyV2({ from_path: '/a', to_path: '/c' });
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.dropboxapi.com/2/files/delete_v2',
                'https://api.dropboxapi.com/2/files/move_v2',
                'https://api.dropboxapi.com/2/files/copy_v2',
            ]);
        });

        it('searchV2 POSTs SearchV2Arg', async () => {
            const api = makeApi();
            await api.searchV2({ query: 'prime' });
            expect(api._captured[0].url).toBe(
                'https://api.dropboxapi.com/2/files/search_v2'
            );
            expect(api._captured[0].body).toEqual({ query: 'prime' });
        });
    });

    describe('content', () => {
        it('downloadFile posts to content host with Dropbox-API-Arg', async () => {
            const api = makeApi();
            await api.downloadFile({ path: '/Homework/math/Prime.txt' });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://content.dropboxapi.com/2/files/download'
            );
            expect(captured.headers['Dropbox-API-Arg']).toBe(
                JSON.stringify({ path: '/Homework/math/Prime.txt' })
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/octet-stream'
            );
        });

        it('uploadFile posts octets to content host', async () => {
            const api = makeApi();
            await api.uploadFile(
                { path: '/Homework/math/Matrices.txt', mode: 'add' },
                Buffer.from('hello')
            );
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://content.dropboxapi.com/2/files/upload'
            );
            expect(captured.headers['Dropbox-API-Arg']).toBe(
                JSON.stringify({
                    path: '/Homework/math/Matrices.txt',
                    mode: 'add',
                })
            );
            expect(Buffer.isBuffer(captured.body)).toBe(true);
            expect(captured.body.toString()).toBe('hello');
        });
    });

    describe('webhook helpers', () => {
        it('handleWebhookChallenge echoes the challenge', () => {
            expect(Api.handleWebhookChallenge('abc123')).toEqual({
                challenge: 'abc123',
                contentType: 'text/plain',
            });
        });

        it('handleWebhookChallenge rejects empty challenge', () => {
            expect(() => Api.handleWebhookChallenge('')).toThrow(/required/i);
        });

        it('verifyWebhookSignature accepts a valid HMAC', () => {
            const body = JSON.stringify({
                list_folder: { accounts: ['dbid:AA'] },
            });
            const secret = 'app-secret';
            const sig = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('hex');
            const result = Api.verifyWebhookSignature({
                appSecret: secret,
                req: {
                    headers: { 'x-dropbox-signature': sig },
                    rawBody: body,
                },
            });
            expect(result).toEqual({ valid: true });
        });

        it('verifyWebhookSignature rejects a bad signature', () => {
            const result = Api.verifyWebhookSignature({
                appSecret: 'app-secret',
                req: {
                    headers: { 'x-dropbox-signature': '00'.repeat(32) },
                    rawBody: '{}',
                },
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/mismatch/i);
        });
    });
});
