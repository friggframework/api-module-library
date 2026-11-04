const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'miro.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const NON_OPERATION_METHODS = new Set([
    'constructor',
    'addJsonHeaders',
    '_buildAuthorizationUri',
    '_url',
    'getAuthUri',
    '_post',
    '_patch',
    '_put',
    '_get',
    '_delete',
]);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares oAuth2AuthCode security matching the vendor OAS', () => {
        const oauth = spec.components.securitySchemes.oAuth2AuthCode;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.authorizationCode.authorizationUrl).toBe(
            'https://miro.com/oauth/authorize'
        );
        expect(oauth.flows.authorizationCode.tokenUrl).toBe(
            'https://api.miro.com/v1/oauth/token'
        );
        // Full vendor scope set (not only boards:*).
        expect(Object.keys(oauth.flows.authorizationCode.scopes).sort()).toEqual(
            [
                'boards:read',
                'boards:write',
                'microphone:listen',
                'organizations:read',
                'organizations:teams:read',
                'organizations:teams:write',
                'screen:record',
                'webcam:record',
            ].sort()
        );
    });

    it('aligns server URL and key schema details with the vendor OAS', () => {
        // Vendor servers[0].url is https://api.miro.com/ (trailing slash).
        expect(spec.servers[0].url).toBe('https://api.miro.com/');

        const token = spec.components.schemas.TokenInformation;
        expect(token.properties.scopes.type).toBe('array');
        expect(token.properties.scopes.items.type).toBe('string');

        const boardChanges = spec.components.schemas.BoardChanges.properties;
        expect(boardChanges).toHaveProperty('projectId');
        expect(boardChanges).toHaveProperty('policy');

        const sort = spec.paths['/v2/boards'].get.parameters.find(
            (p) => p.name === 'sort'
        );
        expect(sort.schema.enum).toEqual([
            'default',
            'last_modified',
            'last_opened',
            'last_created',
            'alphabetically',
        ]);

        const itemType = spec.paths['/v2/boards/{board_id}/items'].get.parameters.find(
            (p) => p.name === 'type'
        );
        expect(itemType.schema.enum).toContain('sticky_note');
        expect(itemType.schema.enum).toContain('data_table_format');

        const shape = spec.components.schemas.StickyNoteData.properties.shape;
        expect(shape.enum).toEqual(['square', 'rectangle']);
        expect(shape.default).toBe('square');
    });

    it('every public Api method is declared in the OpenAPI (1:1)', () => {
        const publicMethods = clientMethods.filter(
            (m) => !NON_OPERATION_METHODS.has(m) && !m.startsWith('_')
        );
        const undeclared = publicMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });
});

describe('capability manifest ↔ client sync', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'miro.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 for module miro at package version', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('miro');
        expect(manifest.package).toBe('@friggframework/api-module-miro');
        expect(manifest.version).toBe(require('../package.json').version);
        expect(manifest.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const missing = Object.entries(manifest.capabilities)
            .filter(([, cap]) => !clientMethods.includes(cap.method))
            .map(([name, cap]) => `${name} → ${cap.method}`);
        expect(missing).toEqual([]);
    });

    it('documents retired experimental webhooks (no webhook capability)', () => {
        expect(manifest.webhook).toBeUndefined();
        expect(manifest.notes.webhooks).toMatch(/retired/i);
        expect(
            Object.keys(manifest.capabilities).some((k) =>
                k.startsWith('webhook.')
            )
        ).toBe(false);
    });
});
