process.env.QBO_OAUTH_KEY = process.env.QBO_OAUTH_KEY || 'test-key';
process.env.QBO_OAUTH_SECRET = process.env.QBO_OAUTH_SECRET || 'test-secret';
process.env.QBO_OAUTH_ENV = process.env.QBO_OAUTH_ENV || 'sandbox';
process.env.QBO_OAUTH_REDIRECT_URI =
    process.env.QBO_OAUTH_REDIRECT_URI || 'https://app.example/redirect/qbo';

jest.mock('intuit-oauth', () => {
    const scopes = {Accounting: 'com.intuit.quickbooks.accounting'};
    const OAuthClient = jest.fn().mockImplementation(() => ({
        authorizeUri: () => 'https://appcenter.intuit.com/connect/oauth2',
        clientId: 'test-key',
        clientSecret: 'test-secret',
        redirectUri: 'https://app.example/redirect/qbo',
        environment: 'sandbox',
        setToken: jest.fn(),
    }));
    OAuthClient.scopes = scopes;
    return OAuthClient;
});

jest.mock('@friggframework/core', () => ({
    OAuth2Requester: class {},
    get: (obj, key, def) =>
        obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null
            ? obj[key]
            : def,
}));

jest.mock('node-quickbooks', () => jest.fn());

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
    DEFAULT_MINOR_VERSION,
    MINOR_VERSIONS_DOCS_URL,
} = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'qbo.openapi.yaml'), 'utf8')
);

describe('OpenAPI spec ↔ minorversion pin', () => {
    it('pins minorversion to DEFAULT_MINOR_VERSION (75) from Intuit docs', () => {
        const param = spec.components.parameters.minorversion;
        expect(DEFAULT_MINOR_VERSION).toBe(75);
        expect(param.schema.default).toBe(DEFAULT_MINOR_VERSION);
        expect(param.schema.minimum).toBe(75);
        expect(param.required).toBe(true);
        expect(param.description).toContain(String(DEFAULT_MINOR_VERSION));
        expect(param.description).toContain(MINOR_VERSIONS_DOCS_URL);
        expect(spec.info.description).toContain('minorversion=75');
        expect(spec.info.description).toContain(MINOR_VERSIONS_DOCS_URL);
        expect(spec.externalDocs.url).toBe(MINOR_VERSIONS_DOCS_URL);

        for (const pathItem of Object.values(spec.paths)) {
            for (const [method, op] of Object.entries(pathItem)) {
                if (
                    !['get', 'post', 'patch', 'put', 'delete'].includes(method)
                ) {
                    continue;
                }
                const refs = (op.parameters || []).map((p) => p.$ref || '');
                expect(refs).toContain('#/components/parameters/minorversion');
            }
        }
    });
});
