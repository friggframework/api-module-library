const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'trello.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'trello.capabilities.json'),
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
        const api = new Api({ api_key: 'x', token: 'y' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares official APIKey+APIToken query security schemes', () => {
        const key = spec.components.securitySchemes.APIKey;
        const token = spec.components.securitySchemes.APIToken;
        expect(key).toEqual(
            expect.objectContaining({
                type: 'apiKey',
                in: 'query',
                name: 'key',
            })
        );
        expect(token).toEqual(
            expect.objectContaining({
                type: 'apiKey',
                in: 'query',
                name: 'token',
            })
        );
        expect(spec.security).toEqual([{ APIKey: [], APIToken: [] }]);
        // Client injects the same query names the OpenAPI securitySchemes declare.
        const api = new Api({ api_key: 'k', token: 't' });
        expect(api._withAuth({}).query).toEqual({ key: 'k', token: 't' });
    });

    it('webhook create/update params are query (not requestBody) per vendor swagger', () => {
        const create = spec.paths['/webhooks/'].post;
        const update = spec.paths['/webhooks/{id}'].put;
        expect(create.requestBody).toBeUndefined();
        expect(update.requestBody).toBeUndefined();
        const createNames = create.parameters.map((p) => p.name).sort();
        expect(createNames).toEqual(
            ['active', 'callbackURL', 'description', 'idModel'].sort()
        );
        expect(
            create.parameters.find((p) => p.name === 'callbackURL').required
        ).toBe(true);
        expect(
            create.parameters.find((p) => p.name === 'idModel').required
        ).toBe(true);
    });

    it('createLabel requires name, color, and idBoard per vendor swagger', () => {
        const params = spec.paths['/labels'].post.parameters;
        for (const name of ['name', 'color', 'idBoard']) {
            expect(params.find((p) => p.name === name).required).toBe(true);
        }
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is a capability-manifest/v0.1 for this package', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('trello');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-trello'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth).toBe('apiKey');
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.entries(capabilities.capabilities)
            .filter(([, cap]) => !clientMethods.includes(cap.method))
            .map(([name, cap]) => `${name} → ${cap.method}`);
        expect(missing).toEqual([]);
    });

    it('objects declare fields with tags where applicable', () => {
        expect(capabilities.objects.card.fields.length).toBeGreaterThan(0);
        expect(
            capabilities.objects.card.fields.some((f) => f.tag)
        ).toBe(true);
        expect(capabilities.objects.board.fields.some((f) => f.tag)).toBe(
            true
        );
    });
});
