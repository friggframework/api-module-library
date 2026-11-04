const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'yotpo.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) =>
            ['get', 'post', 'patch', 'put', 'delete'].includes(m)
        )
        .map(([, op]) => op.operationId)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'yotpo.capabilities.json'),
        'utf8'
    )
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ store_id: 'x', access_token: 't' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares X-Yotpo-Token apiKey security matching the client', () => {
        const scheme = spec.components.securitySchemes.YotpoToken;
        const api = new Api({ access_token: 'x' });
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('X-Yotpo-Token');
        expect(scheme.name).toBe(api.api_key_name);
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is schema capability-manifest/v0.1 shaped', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('yotpo');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-yotpo'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth).toBe('api_key');
        expect(capabilities.objects).toBeDefined();
        expect(capabilities.capabilities).toBeDefined();
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.entries(capabilities.capabilities)
            .filter(([, cap]) => !clientMethods.includes(cap.method))
            .map(([name, cap]) => `${name} → ${cap.method}`);
        expect(missing).toEqual([]);
    });

    it('package version matches capabilities.version', () => {
        const pkg = require('../package.json');
        expect(capabilities.version).toBe(pkg.version);
    });
});
