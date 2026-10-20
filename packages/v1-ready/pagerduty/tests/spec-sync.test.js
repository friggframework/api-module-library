const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'pagerduty.openapi.yaml'),
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
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares the official api_key Authorization security scheme and Accept header', () => {
        // Official OpenAPI securitySchemes only defines api_key (Token token=…).
        const scheme = spec.components.securitySchemes.api_key;
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('Authorization');
        expect(scheme.description).toMatch(/Token token=/);
        const acceptHeader = (scheme['x-additional-headers'] || []).find(
            (h) => h.name === 'Accept'
        );
        expect(acceptHeader).toBeTruthy();
        expect(acceptHeader.schema.default).toBe(
            'application/vnd.pagerduty+json;version=2'
        );
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        expect(acceptHeader.schema.default).toBe(api.acceptHeader);
    });

    it('uses official []-suffixed names for exploded array query params', () => {
        const listIncidents = spec.paths['/incidents'].get;
        const names = (listIncidents.parameters || []).map((p) => p.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'statuses[]',
                'service_ids[]',
                'team_ids[]',
                'user_ids[]',
                'urgencies[]',
                'include[]',
                'since',
                'until',
                'time_zone',
            ])
        );
        expect(names).not.toContain('statuses');
        const fromUpdate = (spec.paths['/incidents/{id}'].put.parameters || []).find(
            (p) => p.name === 'From'
        );
        expect(fromUpdate.required).toBe(true);
    });
});
