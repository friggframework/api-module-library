const fs = require('fs');
const path = require('path');
const { Definition, codeFrom } = require('../definition');
const { Api } = require('../api');
const pkg = require('../index');

const { requiredAuthMethods } = Definition;

describe('Google Analytics Definition', () => {
    it('is named google-analytics and models GoogleAnalytics', () => {
        expect(Definition.getName()).toBe('google-analytics');
        expect(Definition.moduleName).toBe('google-analytics');
        expect(Definition.modelName).toBe('GoogleAnalytics');
        expect(Definition.API).toBe(Api);
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exports Api and Definition from the package entry', () => {
        expect(pkg.Api).toBe(Api);
        expect(pkg.Definition).toBe(Definition);
    });

    it('does not ship ADR-057 canonical mappings (analytics objects do not fit)', () => {
        expect(Definition.mappings).toBeUndefined();
        expect(pkg.extensions).toBeUndefined();
    });

    it('persists access_token and refresh_token on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('retains no client-company or client-module coupling in sources', () => {
        const files = [
            'api.js',
            'definition.js',
            'index.js',
            'README.md',
            'google-analytics.capabilities.json',
        ].map((f) =>
            fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
        );
        const blob = files.join('\n');
        // Strip check: no leftover client integration names from the tarball path.
        expect(blob).not.toMatch(/lefthook\.com\/apps\/frigg-internal/i);
        expect(blob).not.toMatch(/frigg-internal/i);
    });

    describe('codeFrom (oauth-code reimplementation)', () => {
        it('reads code from the top level or params.data', () => {
            expect(codeFrom({ code: 'abc' })).toBe('abc');
            expect(codeFrom({ data: { code: 'nested' } })).toBe('nested');
            expect(codeFrom({})).toBeNull();
        });
    });

    describe('getToken', () => {
        it('exchanges the authorization code via getTokenFromCode', async () => {
            const calls = [];
            const api = {
                getTokenFromCode: async (code) => {
                    calls.push(code);
                    return { access_token: 'tok', refresh_token: 'ref' };
                },
            };
            const result = await requiredAuthMethods.getToken(api, {
                data: { code: 'auth-code-1' },
            });
            expect(calls).toEqual(['auth-code-1']);
            expect(result.access_token).toBe('tok');
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('delegates to the api when present', async () => {
            let called = false;
            const api = {
                getAuthorizationRequirements: () => {
                    called = true;
                    return { type: 'oauth2', url: 'https://example.com/auth' };
                },
            };
            const reqs =
                await requiredAuthMethods.getAuthorizationRequirements(api);
            expect(called).toBe(true);
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('https://example.com/auth');
        });
    });

    describe('entity / credential identity', () => {
        it('derives externalId from Google userinfo', async () => {
            const api = {
                getTokenIdentity: async () => ({
                    identifier: 'gid-42',
                    name: 'Analyst',
                    email: 'analyst@example.com',
                }),
            };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'user-1'
            );
            const credential = await requiredAuthMethods.getCredentialDetails(
                api,
                'user-1'
            );

            expect(entity.identifiers.externalId).toBe('gid-42');
            expect(entity.identifiers.userId).toBe('user-1');
            expect(entity.details.name).toBe('Analyst');
            expect(entity.details.email).toBe('analyst@example.com');
            expect(credential.identifiers.externalId).toBe('gid-42');
        });
    });

    describe('testAuthRequest', () => {
        it('delegates to api.testAuth', async () => {
            let called = false;
            const api = {
                testAuth: async () => {
                    called = true;
                    return { name: 'properties/0/metadata' };
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).resolves.toEqual({ name: 'properties/0/metadata' });
            expect(called).toBe(true);
        });
    });

    describe('env', () => {
        it('exposes google-analytics-prefixed credential env keys', () => {
            expect(Object.keys(Definition.env)).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'redirect_uri',
                    'scope',
                ])
            );
        });
    });
});
