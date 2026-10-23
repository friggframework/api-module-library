const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'figma.openapi.yaml'), 'utf8')
);

const HTTP = ['get', 'post', 'patch', 'put', 'delete'];

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => HTTP.includes(m))
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
            client_id: 'cid',
            client_secret: 'csecret',
            redirect_uri: 'https://example.com/redirect/figma',
            scope: 'current_user:read',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe('https://api.figma.com');
    });

    it('declares OAuth2 security with Figma authorize/token/refresh URLs', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        const flow = scheme.flows.authorizationCode;
        expect(flow.authorizationUrl).toBe('https://www.figma.com/oauth');
        expect(flow.tokenUrl).toBe('https://api.figma.com/v1/oauth/token');
        expect(flow.refreshUrl).toBe('https://api.figma.com/v1/oauth/refresh');
    });

    it('matches the vendor OpenAPI shape (no global security; per-op scopes)', () => {
        // Official figma/rest-api-spec leaves security on each operation.
        expect(spec.security).toBeUndefined();
        const oauthScopes = new Set(
            Object.keys(
                spec.components.securitySchemes.OAuth2.flows.authorizationCode
                    .scopes
            )
        );
        for (const item of Object.values(spec.paths)) {
            for (const [method, op] of Object.entries(item)) {
                if (!HTTP.includes(method)) continue;
                expect(op.operationId).toBeTruthy();
                expect(op.responses).toBeTruthy();
                for (const sec of op.security || []) {
                    if (sec.OAuth2) {
                        for (const scope of sec.OAuth2) {
                            expect(oauthScopes.has(scope)).toBe(true);
                        }
                    }
                }
            }
        }
    });

    it('preserves official putWebhook required team_id quirk', () => {
        const schema =
            spec.paths['/v2/webhooks/{webhook_id}'].put.requestBody.content[
                'application/json'
            ].schema;
        expect(schema.required).toEqual(
            expect.arrayContaining([
                'event_type',
                'team_id',
                'endpoint',
                'passcode',
            ])
        );
        // Vendor schema lists team_id as required but omits it from properties.
        expect(schema.properties.team_id).toBeUndefined();
    });

    it('documents getFolderFiles branch_data query param', () => {
        const names = (
            spec.paths['/v2/folders/{folder_id}/files'].get.parameters || []
        ).map((p) => p.name);
        expect(names).toContain('branch_data');
    });
});
