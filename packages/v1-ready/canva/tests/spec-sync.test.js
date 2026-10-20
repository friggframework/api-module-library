const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'canva.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

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
        const api = new Api({
            client_id: 'x',
            client_secret: 'y',
            redirect_uri: 'http://localhost/canva',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 + Basic Auth security matching Canva authorize/token URLs', () => {
        const oauth = spec.components.securitySchemes.oauthAuthCode;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.authorizationCode.authorizationUrl).toBe(
            'https://www.canva.com/api/oauth/authorize'
        );
        expect(oauth.flows.authorizationCode.tokenUrl).toBe(
            'https://api.canva.com/rest/v1/oauth/token'
        );
        expect(spec.components.securitySchemes.basicAuth.type).toBe('http');
        expect(spec.components.securitySchemes.basicAuth.scheme).toBe('basic');
    });

    it('listFolderItems item_types is an array (official form/explode=false)', () => {
        const param = spec.paths['/v1/folders/{folderId}/items'].get.parameters.find(
            (p) => p.name === 'item_types'
        );
        expect(param.schema.type).toBe('array');
        expect(param.explode).toBe(false);
    });

    it('Asset-Upload-Metadata schema requires only name_base64', () => {
        const meta = spec.components.schemas.AssetUploadMetadata;
        expect(meta.required).toEqual(['name_base64']);
        expect(Object.keys(meta.properties)).toEqual(['name_base64']);
    });
});

describe('Capability manifest ↔ fenestra (ADR-020)', () => {
    const capabilities = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'canva.capabilities.json'),
            'utf8'
        )
    );

    it('declares ui.appsSdk with fenestra spec pointing at canva.fenestra.yaml', () => {
        const ui = capabilities.capabilities['ui.appsSdk'];
        expect(ui.spec).toEqual({
            kind: 'fenestra',
            ref: './canva.fenestra.yaml',
        });
        expect(
            fs.existsSync(path.join(__dirname, '..', 'canva.fenestra.yaml'))
        ).toBe(true);
    });

    it('every non-ui capability method exists on Api', () => {
        const missing = Object.entries(capabilities.capabilities)
            .filter(([, cap]) => cap.method)
            .map(([, cap]) => cap.method)
            .filter((method) => !clientMethods.includes(method));
        expect(missing).toEqual([]);
    });
});
