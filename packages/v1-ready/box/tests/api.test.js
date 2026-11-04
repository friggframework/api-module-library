const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'box-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/box',
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
        return { id: '1' };
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

describe('Box Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to api.box.com/2.0 and upload host', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://api.box.com/2.0');
            expect(api.uploadBaseUrl).toBe('https://upload.box.com/api/2.0');
            expect(api.tokenUri).toBe('https://api.box.com/oauth2/token');
        });

        it('builds an authorize URL on account.box.com', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/box',
                scope: 'root_readwrite manage_webhook',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://account.box.com/api/oauth2/authorize?'
            );
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('scope=root_readwrite+manage_webhook');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fbox'
            );
            expect(uri).toContain('state=xyz');
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
        it('getCurrentUser hits GET /users/me', async () => {
            const api = makeApi();
            await api.getCurrentUser({ fields: 'id,name,login' });
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/users/me'
            );
            expect(api._captured[0].params).toEqual({
                fields: 'id,name,login',
            });
        });
    });

    describe('folders', () => {
        it('getFolder hits GET /folders/{id}', async () => {
            const api = makeApi();
            await api.getFolder('0');
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/folders/0'
            );
        });

        it('listFolderItems hits GET /folders/{id}/items', async () => {
            const api = makeApi();
            await api.listFolderItems('0', { limit: 100, offset: 0 });
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/folders/0/items'
            );
            expect(api._captured[0].params).toEqual({
                limit: 100,
                offset: 0,
            });
        });

        it('createFolder POSTs JSON to /folders', async () => {
            const api = makeApi();
            const body = { name: 'Contracts', parent: { id: '0' } };
            await api.createFolder(body);
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/folders'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateFolder PUTs to /folders/{id}', async () => {
            const api = makeApi();
            await api.updateFolder('9', { name: 'Renamed' });
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/folders/9'
            );
            expect(api._captured[0].body).toEqual({ name: 'Renamed' });
        });

        it('deleteFolder DELETEs /folders/{id}', async () => {
            const api = makeApi();
            await api.deleteFolder('9', { recursive: true });
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/folders/9'
            );
            expect(api._captured[0].params).toEqual({ recursive: true });
        });
    });

    describe('files', () => {
        it('getFile / updateFile / deleteFile hit /files/{id}', async () => {
            const api = makeApi();
            await api.getFile('42');
            await api.updateFile('42', { name: 'a.pdf' });
            await api.deleteFile('42');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured.every((c) => c.url.endsWith('/files/42'))).toBe(
                true
            );
        });

        it('downloadFile hits GET /files/{id}/content', async () => {
            const api = makeApi();
            await api.downloadFile('42');
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/files/42/content'
            );
        });

        it('uploadFile POSTs multipart to upload.box.com', async () => {
            const api = makeApi();
            await api.uploadFile({
                attributes: { name: 'hello.txt', parent: { id: '0' } },
                file: Buffer.from('hello'),
                filename: 'hello.txt',
                contentType: 'text/plain',
            });
            const call = api._captured[0];
            expect(call.url).toBe(
                'https://upload.box.com/api/2.0/files/content'
            );
            expect(call.headers['Content-Type']).toMatch(
                /^multipart\/form-data; boundary=/
            );
            expect(Buffer.isBuffer(call.body)).toBe(true);
            const bodyStr = call.body.toString('utf8');
            expect(bodyStr).toContain('name="attributes"');
            expect(bodyStr).toContain('"name":"hello.txt"');
            expect(bodyStr).toContain('name="file"');
            expect(bodyStr).toContain('hello');
        });
    });

    describe('search', () => {
        it('searchContent hits GET /search', async () => {
            const api = makeApi();
            await api.searchContent({ query: 'contract', limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/search'
            );
            expect(api._captured[0].params).toEqual({
                query: 'contract',
                limit: 10,
            });
        });
    });

    describe('webhooks', () => {
        it('list/create/get/update/delete webhook paths', async () => {
            const api = makeApi();
            await api.listWebhooks({ limit: 100 });
            await api.createWebhook({
                target: { id: '0', type: 'folder' },
                address: 'https://hook.example.com',
                triggers: ['FILE.UPLOADED'],
            });
            await api.getWebhook('wh1');
            await api.updateWebhook('wh1', {
                address: 'https://hook.example.com/v2',
            });
            await api.deleteWebhook('wh1');
            expect(api._captured[0].url).toBe(
                'https://api.box.com/2.0/webhooks'
            );
            expect(api._captured[1].url).toBe(
                'https://api.box.com/2.0/webhooks'
            );
            expect(api._captured[2].url).toBe(
                'https://api.box.com/2.0/webhooks/wh1'
            );
            expect(api._captured[3].method).toBe('PUT');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('verifyWebhookSignature', () => {
        const primaryKey = 'primary-secret';
        const secondaryKey = 'secondary-secret';
        const body = '{"type":"webhook_event","id":"evt1","trigger":"FILE.UPLOADED"}';
        const timestamp = new Date().toISOString();

        function sign(key) {
            return crypto
                .createHmac('sha256', key)
                .update(body)
                .update(timestamp)
                .digest('base64');
        }

        it('accepts a valid primary signature', () => {
            const result = Api.verifyWebhookSignature({
                req: {
                    headers: {
                        'box-delivery-timestamp': timestamp,
                        'box-signature-primary': sign(primaryKey),
                    },
                    rawBody: body,
                },
                primaryKey,
                secondaryKey,
            });
            expect(result).toEqual({ valid: true });
        });

        it('accepts a valid secondary signature', () => {
            const result = Api.verifyWebhookSignature({
                req: {
                    headers: {
                        'BOX-DELIVERY-TIMESTAMP': timestamp,
                        'BOX-SIGNATURE-SECONDARY': sign(secondaryKey),
                    },
                    rawBody: body,
                },
                primaryKey,
                secondaryKey,
            });
            expect(result).toEqual({ valid: true });
        });

        it('rejects expired timestamps', () => {
            const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
            const result = Api.verifyWebhookSignature({
                req: {
                    headers: {
                        'box-delivery-timestamp': old,
                        'box-signature-primary': crypto
                            .createHmac('sha256', primaryKey)
                            .update(body)
                            .update(old)
                            .digest('base64'),
                    },
                    rawBody: body,
                },
                primaryKey,
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/expired/i);
        });

        it('rejects mismatched signatures', () => {
            const result = Api.verifyWebhookSignature({
                req: {
                    headers: {
                        'box-delivery-timestamp': timestamp,
                        'box-signature-primary': 'not-a-real-sig',
                    },
                    rawBody: body,
                },
                primaryKey,
            });
            expect(result.valid).toBe(false);
        });
    });
});
