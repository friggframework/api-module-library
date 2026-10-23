const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'OC-test',
        client_secret: 'cnvca_test',
        redirect_uri: 'https://example.com/redirect/canva',
        scope: 'openid profile design:meta:read',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'a', refresh_token: 'r', expires_in: 3600 };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Canva Api', () => {
    describe('construction & auth', () => {
        it('sets the Connect REST base URL and token URI', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/canva',
            });
            expect(api.baseUrl).toBe('https://api.canva.com/rest');
            expect(api.tokenUri).toBe(
                'https://api.canva.com/rest/v1/oauth/token'
            );
            expect(api.authBaseUrl).toBe('https://www.canva.com/api');
        });

        it('generatePkce produces verifier + S256 challenge and stores verifier', () => {
            const api = makeApi();
            const { codeVerifier, codeChallenge } = api.generatePkce();
            expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
            expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(api.code_verifier).toBe(codeVerifier);
            expect(codeChallenge).not.toBe(codeVerifier);
        });

        it('getAuthUri includes PKCE challenge and required OAuth params', () => {
            const api = makeApi({ state: 'st1' });
            const url = new URL(api.getAuthUri());
            expect(url.origin + url.pathname).toBe(
                'https://www.canva.com/api/oauth/authorize'
            );
            expect(url.searchParams.get('response_type')).toBe('code');
            expect(url.searchParams.get('client_id')).toBe('OC-test');
            expect(url.searchParams.get('code_challenge_method')).toBe('S256');
            expect(url.searchParams.get('code_challenge')).toBeTruthy();
            expect(url.searchParams.get('scope')).toContain('design:meta:read');
            expect(api.code_verifier).toBeTruthy();
        });

        it('getTokenFromCode posts form body with Basic Auth and code_verifier', async () => {
            const api = makeApi();
            api.code_verifier = 'verifier-abc';
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.canva.com/rest/v1/oauth/token'
            );
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            expect(captured.body.get('grant_type')).toBe('authorization_code');
            expect(captured.body.get('code')).toBe('auth-code');
            expect(captured.body.get('code_verifier')).toBe('verifier-abc');
        });

        it('getTokenFromCode throws when code_verifier is missing', async () => {
            const api = makeApi({ code_verifier: null });
            api.code_verifier = null;
            await expect(api.getTokenFromCode('c')).rejects.toThrow(/code_verifier/i);
        });
    });

    describe('identity', () => {
        it('usersMe hits GET /v1/users/me', async () => {
            const api = makeApi();
            await api.usersMe();
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/users/me'
            );
        });

        it('getUserProfile hits GET /v1/users/me/profile', async () => {
            const api = makeApi();
            await api.getUserProfile();
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/users/me/profile'
            );
        });

        it('userInfo hits GET /v1/oidc/userinfo', async () => {
            const api = makeApi();
            await api.userInfo();
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/oidc/userinfo'
            );
        });
    });

    describe('designs', () => {
        it('listDesigns hits GET /v1/designs with query params', async () => {
            const api = makeApi();
            await api.listDesigns({
                query: 'summer',
                ownership: 'owned',
                limit: 10,
            });
            const { url } = api._captured[0];
            expect(url).toContain('https://api.canva.com/rest/v1/designs?');
            expect(url).toContain('query=summer');
            expect(url).toContain('ownership=owned');
            expect(url).toContain('limit=10');
        });

        it('getDesign hits GET /v1/designs/{id}', async () => {
            const api = makeApi();
            await api.getDesign('DAFVztcvd9z');
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/designs/DAFVztcvd9z'
            );
        });

        it('createDesign POSTs JSON body', async () => {
            const api = makeApi();
            const body = {
                type: 'type_and_asset',
                title: 'Hello',
                design_type: { type: 'preset', name: 'presentation' },
            };
            await api.createDesign(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/designs'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('createDesignExportJob and getDesignExportJob hit /v1/exports', async () => {
            const api = makeApi();
            await api.createDesignExportJob({
                design_id: 'D1',
                format: { type: 'pdf' },
            });
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/exports'
            );
            await api.getDesignExportJob('exp_1');
            expect(api._captured[1].url).toBe(
                'https://api.canva.com/rest/v1/exports/exp_1'
            );
        });
    });

    describe('folders', () => {
        it('create/get/update/delete folder paths', async () => {
            const api = makeApi();
            await api.createFolder({ name: 'A', parent_folder_id: 'root' });
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/folders'
            );
            await api.getFolder('F1');
            expect(api._captured[1].url).toBe(
                'https://api.canva.com/rest/v1/folders/F1'
            );
            await api.updateFolder('F1', { name: 'B' });
            expect(api._captured[2].method).toBe('PATCH');
            await api.deleteFolder('F1');
            expect(api._captured[3].method).toBe('DELETE');
        });

        it('listFolderItems serializes item_types arrays as comma lists', async () => {
            const api = makeApi();
            await api.listFolderItems('root', {
                item_types: ['design', 'folder'],
                limit: 50,
            });
            const { url } = api._captured[0];
            expect(url).toContain('/v1/folders/root/items?');
            expect(url).toContain('item_types=design%2Cfolder');
        });

        it('moveFolderItem POSTs to /v1/folders/move', async () => {
            const api = makeApi();
            await api.moveFolderItem({
                to_folder_id: 'F2',
                item_id: 'DAF1',
            });
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/folders/move'
            );
        });
    });

    describe('assets', () => {
        it('get/update/delete asset paths', async () => {
            const api = makeApi();
            await api.getAsset('A1');
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/assets/A1'
            );
            await api.updateAsset('A1', { name: 'n', tags: ['t'] });
            expect(api._captured[1].method).toBe('PATCH');
            await api.deleteAsset('A1');
            expect(api._captured[2].method).toBe('DELETE');
        });

        it('createAssetUploadJob sends octet-stream + name_base64 metadata header', async () => {
            const api = makeApi();
            const binary = Buffer.from('fake-image');
            const name_base64 = Buffer.from('pic.png').toString('base64');
            await api.createAssetUploadJob(binary, { name_base64 });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.canva.com/rest/v1/asset-uploads'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/octet-stream'
            );
            expect(captured.headers['Asset-Upload-Metadata']).toBe(
                JSON.stringify({ name_base64 })
            );
            expect(Buffer.isBuffer(captured.body)).toBe(true);
        });

        it('getAssetUploadJob hits GET /v1/asset-uploads/{jobId}', async () => {
            const api = makeApi();
            await api.getAssetUploadJob('job_1');
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/asset-uploads/job_1'
            );
        });
    });

    describe('webhook signing keys', () => {
        it('getSigningPublicKeys hits GET /v1/connect/keys', async () => {
            const api = makeApi();
            await api.getSigningPublicKeys();
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/connect/keys'
            );
        });
    });

    describe('v1 ports: import / generation / comments / brand templates', () => {
        it('createDesignImportJob posts octet-stream + Import-Metadata', async () => {
            const api = makeApi();
            await api.createDesignImportJob(Buffer.from('pdf'), {
                title_base64: Buffer.from('x.pdf').toString('base64'),
            });
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/imports'
            );
            expect(api._captured[0].headers['Import-Metadata']).toContain(
                'title_base64'
            );
        });

        it('importDesign encodes title into metadata (v1 helper)', async () => {
            const api = makeApi();
            await api.importDesign(Buffer.from('x'), 'Holiday.pdf');
            const meta = JSON.parse(
                api._captured[0].headers['Import-Metadata']
            );
            expect(Buffer.from(meta.title_base64, 'base64').toString()).toBe(
                'Holiday.pdf'
            );
        });

        it('getDesignImportJob hits /v1/imports/{jobId}', async () => {
            const api = makeApi();
            await api.getDesignImportJob('job_1');
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/imports/job_1'
            );
        });

        it('createDesignGenerationJobV2 / getDesignGenerationJobV2 use /v1/generations', async () => {
            const api = makeApi();
            await api.createDesignGenerationJobV2({ query: 'poster' });
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/generations'
            );
            await api.getDesignGenerationJobV2('g1');
            expect(api._captured[1].url).toBe(
                'https://api.canva.com/rest/v1/generations/g1'
            );
        });

        it('createComment / createThread / getThread / createReply hit official paths', async () => {
            const api = makeApi();
            await api.createComment({ message: 'hi' });
            expect(api._captured[0].url).toBe(
                'https://api.canva.com/rest/v1/comments'
            );
            await api.createThread('D1', { message: 't' });
            expect(api._captured[1].url).toBe(
                'https://api.canva.com/rest/v1/designs/D1/comments'
            );
            await api.getThread('D1', 'T1');
            expect(api._captured[2].url).toBe(
                'https://api.canva.com/rest/v1/designs/D1/comments/T1'
            );
            await api.createReply('D1', 'T1', { message: 'r' });
            expect(api._captured[3].url).toBe(
                'https://api.canva.com/rest/v1/designs/D1/comments/T1/replies'
            );
        });

        it('listBrandTemplates and listCanvaTemplates (v1 alias) hit /v1/brand-templates', async () => {
            const api = makeApi();
            await api.listCanvaTemplates({ query: 'sale', limit: 4 });
            expect(api._captured[0].url).toContain(
                '/v1/brand-templates?query=sale&limit=4'
            );
        });

        it('getTokenIdentity uses introspect sub (v1 Manager identity)', async () => {
            const api = makeApi({ access_token: 'tok' });
            api.introspectToken = async () => ({ sub: 'U_SUB', active: true });
            const id = await api.getTokenIdentity();
            expect(id.identifier).toBe('U_SUB');
            expect(id.name).toBe('U_SUB');
        });

        it('uploadAsset maps name→name_base64 and posts to /v1/asset-uploads', async () => {
            const api = makeApi();
            await api.uploadAsset(Buffer.from('img'), {
                name: 'logo.png',
                parent_folder_id: 'root',
                tags: 'x',
            });
            expect(api._captured[0].url).toContain('/v1/asset-uploads');
            const meta = JSON.parse(
                api._captured[0].headers['Asset-Upload-Metadata']
            );
            expect(meta.name_base64).toBe(
                Buffer.from('logo.png').toString('base64')
            );
            expect(meta.parent_folder_id).toBeUndefined();
        });
    });
});
