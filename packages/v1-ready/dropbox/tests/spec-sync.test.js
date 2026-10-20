const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'dropbox.openapi.yaml'), 'utf8')
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
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares oauth2 security matching Dropbox authorize/token URLs', () => {
        const scheme = spec.components.securitySchemes.oauth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://www.dropbox.com/oauth2/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://api.dropboxapi.com/oauth2/token'
        );
        const scopes = scheme.flows.authorizationCode.scopes;
        expect(scopes.openid).toBeDefined();
        expect(scopes.profile).toBeDefined();
        expect(scopes.email).toBeDefined();
        expect(scopes['account_info.read']).toBeDefined();
        expect(scopes['files.metadata.read']).toBeDefined();
        expect(scopes['files.content.write']).toBeDefined();
        expect(scopes['sharing.read']).toBeDefined();
    });
});
