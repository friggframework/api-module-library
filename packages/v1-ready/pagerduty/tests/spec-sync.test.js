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

    it('declares oauth2 security with PagerDuty identity endpoints and Accept header', () => {
        const scheme = spec.components.securitySchemes.oauth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://identity.pagerduty.com/oauth/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://identity.pagerduty.com/oauth/token'
        );
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
});
