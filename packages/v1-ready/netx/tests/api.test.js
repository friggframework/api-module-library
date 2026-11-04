const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        access_token: 'tok',
        baseUrl: 'https://example.netx.net',
        ...overrides,
    });
    api._captured = [];
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { jsonrpc: '2.0', id: '1', result: {} };
    };
    api._request = async (url, options) => {
        api._captured.push({ method: options.method || 'GET', url, ...options });
        return { id: 99 };
    };
    return api;
}

describe('NetX Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the OpenAPI placeholder and rebuilds OAuth URLs', () => {
            const api = new Api({ client_id: 'cid', scope: 'api' });
            expect(api.baseUrl).toBe('https://example.netx.net');
            expect(api.tokenUri).toBe('https://example.netx.net/a/t');
            expect(api.authorizationUri).toContain(
                'https://example.netx.net/app?'
            );
            expect(api.authorizationUri).toContain('response_type=code');
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toMatch(/#access\/api$/);
        });

        it('setBaseUrl strips trailing slashes and rebuilds URLs', () => {
            const api = new Api({ client_id: 'c' });
            api.setBaseUrl('https://acme.netx.net/');
            expect(api.baseUrl).toBe('https://acme.netx.net');
            expect(api.tokenUri).toBe('https://acme.netx.net/a/t');
        });

        it('adds Authorization: apiToken <token> (not Bearer)', async () => {
            const api = new Api({
                access_token: 'secret',
                baseUrl: 'https://example.netx.net',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('apiToken secret');
            expect(headers.Authorization).not.toMatch(/^Bearer /);
        });

        it('exposes an oauth2 authorization form that requires baseUrl', () => {
            const api = new Api({ client_id: 'c', baseUrl: 'https://example.netx.net' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.data.jsonSchema.required).toContain('baseUrl');
            expect(reqs.url).toContain('https://example.netx.net/app?');
        });
    });

    describe('JSON-RPC helpers', () => {
        it('getSelf POSTs method getSelf with [null]', async () => {
            const api = makeApi();
            await api.getSelf();
            const body = api._captured[0].body;
            expect(api._captured[0].url).toBe(
                'https://example.netx.net/api/rpc'
            );
            expect(body.method).toBe('getSelf');
            expect(body.params).toEqual([null]);
            expect(body.jsonrpc).toBe('2.0');
            expect(body.id).toBeTruthy();
        });

        it('getAssets wraps a single id in an array', async () => {
            const api = makeApi();
            await api.getAssets(42);
            expect(api._captured[0].body.method).toBe('getAssets');
            expect(api._captured[0].body.params[0]).toEqual([42]);
        });

        it('getAssetsByFolder sends folderId, recursive, options', async () => {
            const api = makeApi();
            await api.getAssetsByFolder(12, false, {
                page: { startIndex: 0, size: 2 },
                data: ['asset.id'],
            });
            expect(api._captured[0].body.method).toBe('getAssetsByFolder');
            expect(api._captured[0].body.params).toEqual([
                12,
                false,
                {
                    page: { startIndex: 0, size: 2 },
                    data: ['asset.id'],
                },
            ]);
        });

        it('getAssetsByQuery wraps a bare clause array as { query }', async () => {
            const api = makeApi();
            const clauses = [{ operator: 'and', exact: { attribute: 'a', value: 'b' } }];
            await api.getAssetsByQuery(clauses, { data: ['asset.id'] });
            expect(api._captured[0].body.method).toBe('getAssetsByQuery');
            expect(api._captured[0].body.params[0]).toEqual({ query: clauses });
        });

        it('updateAsset sends the asset object', async () => {
            const api = makeApi();
            await api.updateAsset({ id: 1, name: 'n', fileName: 'f.jpg' });
            expect(api._captured[0].body.method).toBe('updateAsset');
            expect(api._captured[0].body.params[0]).toEqual({
                id: 1,
                name: 'n',
                fileName: 'f.jpg',
            });
        });

        it('createFolder / getFolderById / getFoldersByParent hit the right methods', async () => {
            const api = makeApi();
            await api.createFolder({ parentId: 1, name: 'X' });
            await api.getFolderById(37);
            await api.getFoldersByParent(1);
            expect(api._captured.map((c) => c.body.method)).toEqual([
                'createFolder',
                'getFolderById',
                'getFoldersByParent',
            ]);
        });

        it('setWebhook / getWebhooks / deleteWebhook hit the right methods', async () => {
            const api = makeApi();
            await api.setWebhook({
                id: 0,
                name: 'wh',
                endpointUrl: 'https://hook.example',
                actions: ['asset.create'],
            });
            await api.getWebhooks();
            await api.deleteWebhook(12);
            expect(api._captured.map((c) => c.body.method)).toEqual([
                'setWebhook',
                'getWebhooks',
                'deleteWebhook',
            ]);
            expect(api._captured[2].body.params).toEqual([12]);
        });

        it('surfaces JSON-RPC errors', async () => {
            const api = makeApi();
            api._post = async () => ({
                jsonrpc: '2.0',
                error: { code: 123, message: 'nope' },
            });
            await expect(api.getSelf()).rejects.toThrow(/NetX JSON-RPC error 123/);
        });
    });

    describe('importAsset', () => {
        it('POSTs multipart to /api/import/asset', async () => {
            const api = makeApi();
            const filePath = require('path').join(__dirname, '..', 'package.json');
            await api.importAsset({ filePath }, 7);
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://example.netx.net/api/import/asset'
            );
            expect(captured.method).toBe('POST');
            expect(captured.body).toBeTruthy();
        });
    });
});
