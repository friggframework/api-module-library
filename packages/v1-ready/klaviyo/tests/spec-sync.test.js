const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'klaviyo.openapi.yaml'), 'utf8')
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

    it('declares OAuth2 and private-key security schemes', () => {
        expect(spec.components.securitySchemes.OAuth2.type).toBe('oauth2');
        expect(
            spec.components.securitySchemes.OAuth2.flows.authorizationCode
                .authorizationUrl
        ).toBe('https://www.klaviyo.com/oauth/authorize');
        expect(
            spec.components.securitySchemes.OAuth2.flows.authorizationCode
                .tokenUrl
        ).toBe('https://a.klaviyo.com/oauth/token');

        const keyScheme = spec.components.securitySchemes.KlaviyoApiKey;
        expect(keyScheme.type).toBe('apiKey');
        expect(keyScheme.in).toBe('header');
        expect(keyScheme.name).toBe('Authorization');
    });

    it('pins the revision header default to the client default', () => {
        const revisionParam =
            spec.components.parameters.Revision.schema.default;
        const api = new Api({ access_token: 'x' });
        expect(revisionParam).toBe(api.revision);
    });

    it('includes the four restored profile capability operations', () => {
        expect(specOperationIds).toEqual(
            expect.arrayContaining([
                'createOrUpdateProfile',
                'getProfileLists',
                'subscribeProfiles',
                'unsubscribeProfiles',
            ])
        );
    });
});
