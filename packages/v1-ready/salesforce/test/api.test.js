jest.mock('jsforce', () => {
    const mockGetAuthorizationUrl = jest.fn((options) => {
        const scope = options?.scope ? `&scope=${encodeURIComponent(options.scope)}` : '';
        return `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%2Fredirect%2Fsalesforce${scope}`;
    });

    const mockConnection = {
        on: jest.fn(),
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        instanceUrl: 'https://test.salesforce.com',
    };

    return {
        OAuth2: jest.fn().mockImplementation((params) => ({
            getAuthorizationUrl: mockGetAuthorizationUrl,
            _params: params,
        })),
        Connection: jest.fn().mockImplementation(() => mockConnection),
    };
});

const { Api } = require('../api');

const baseParams = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uri: 'http://localhost/redirect/salesforce',
    delegate: { notify: jest.fn(), addDelegate: jest.fn(), delegateTypes: [] },
};

describe('Salesforce Api', () => {
    let api;

    beforeEach(() => {
        jest.clearAllMocks();
        api = new Api(baseParams);
    });

    describe('getAuthorizationUri', () => {
        it('should be synchronous (not return a Promise)', () => {
            const result = api.getAuthorizationUri();
            expect(result).not.toBeInstanceOf(Promise);
        });

        it('should return a string URL', () => {
            const result = api.getAuthorizationUri();
            expect(typeof result).toBe('string');
            expect(result).toContain('login.salesforce.com');
        });

        it('should include refresh_token scope', () => {
            const result = api.getAuthorizationUri();
            expect(result).toContain('refresh_token');
        });

        it('should include full scope', () => {
            const result = api.getAuthorizationUri();
            expect(result).toContain('full');
        });
    });

    describe('resetToSandbox', () => {
        it('should use redirect_uri (snake_case) not redirectUri (camelCase)', () => {
            const jsforce = require('jsforce');
            api.resetToSandbox();

            const sandboxCall = jsforce.OAuth2.mock.calls.find(
                (call) => call[0].loginUrl === 'https://test.salesforce.com'
            );
            expect(sandboxCall).toBeDefined();
            expect(sandboxCall[0].redirectUri).toBe(baseParams.redirect_uri);
        });

        it('should set isSandbox to true', () => {
            api.resetToSandbox();
            expect(api.isSandbox).toBe(true);
        });

        it('should use sandbox login URL', () => {
            const jsforce = require('jsforce');
            api.resetToSandbox();

            const sandboxCall = jsforce.OAuth2.mock.calls.find(
                (call) => call[0].loginUrl === 'https://test.salesforce.com'
            );
            expect(sandboxCall[0].loginUrl).toBe('https://test.salesforce.com');
        });
    });

    describe('constructor', () => {
        it('should use production login URL when not sandbox', () => {
            const jsforce = require('jsforce');
            new Api(baseParams);
            const firstCall = jsforce.OAuth2.mock.calls[0];
            expect(firstCall[0].loginUrl).toBe('https://login.salesforce.com');
        });

        it('should use sandbox login URL when isSandbox is true', () => {
            const jsforce = require('jsforce');
            new Api({ ...baseParams, isSandbox: true });
            const lastCall = jsforce.OAuth2.mock.calls[jsforce.OAuth2.mock.calls.length - 1];
            expect(lastCall[0].loginUrl).toBe('https://test.salesforce.com');
        });

        it('should initialize Connection with access and refresh tokens', () => {
            const jsforce = require('jsforce');
            const params = {
                ...baseParams,
                access_token: 'my-access-token',
                refresh_token: 'my-refresh-token',
                instanceUrl: 'https://myorg.salesforce.com',
            };
            new Api(params);
            const lastCall = jsforce.Connection.mock.calls[jsforce.Connection.mock.calls.length - 1];
            expect(lastCall[0].accessToken).toBe('my-access-token');
            expect(lastCall[0].refreshToken).toBe('my-refresh-token');
            expect(lastCall[0].instanceUrl).toBe('https://myorg.salesforce.com');
        });
    });
});
