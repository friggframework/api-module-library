const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'gohighlevel.openapi.yaml'),
        'utf8'
    )
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
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 security matching Marketplace authorize + token URLs', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(
            scheme.flows.authorizationCode.authorizationUrl
        ).toContain('marketplace.gohighlevel.com/v2/oauth/chooselocation');
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://services.leadconnectorhq.com/oauth/token'
        );
        const scopes = scheme.flows.authorizationCode.scopes;
        expect(scopes['contacts.readonly']).toBeDefined();
        expect(scopes['opportunities.write']).toBeDefined();
    });

    it('capability manifest methods all exist on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'gohighlevel.capabilities.json'),
                'utf8'
            )
        );
        const methods = Object.values(manifest.capabilities).map((c) => c.method);
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
        expect(manifest.module).toBe('gohighlevel');
        expect(manifest.package).toBe('@friggframework/api-module-gohighlevel');
        expect(manifest.version).toBe('1.0.0');
        expect(manifest.auth).toBe('oauth2');
    });
});
