process.env.QBO_OAUTH_KEY = 'test-key';
process.env.QBO_OAUTH_SECRET = 'test-secret';
process.env.QBO_OAUTH_ENV = 'sandbox';
process.env.QBO_OAUTH_REDIRECT_URI = 'https://app.example/redirect/qbo';

jest.mock('intuit-oauth', () => {
    const scopes = {Accounting: 'com.intuit.quickbooks.accounting'};
    const OAuthClient = jest.fn().mockImplementation(() => ({
        authorizeUri: () => 'https://appcenter.intuit.com/connect/oauth2',
        clientId: 'test-key',
        clientSecret: 'test-secret',
        redirectUri: 'https://app.example/redirect/qbo',
        environment: 'sandbox',
        setToken: jest.fn(),
        createToken: jest.fn(),
        refreshUsingToken: jest.fn(),
    }));
    OAuthClient.scopes = scopes;
    return OAuthClient;
});

jest.mock('@friggframework/core', () => {
    class OAuth2Requester {
        constructor(params = {}) {
            this.accessToken = params.accessToken || null;
            this.refreshToken = params.refreshToken || null;
            this.accessTokenExpire =
                params.accessTokenExpire || Date.now() + 3_600_000;
            this.refreshTokenExpire =
                params.refreshTokenExpire || Date.now() + 86_400_000;
            this.key = params.key;
            this.secret = params.secret;
            this.redirectUri = params.redirectUri;
            this.authorizationUri = params.authorizationUri;
            this.baseURL = params.baseURL;
            this.DLGT_TOKEN_DEAUTHORIZED = 'TOKEN_DEAUTHORIZED';
            this.DLGT_TOKEN_UPDATE = 'TOKEN_UPDATE';
        }

        isAuthenticated() {
            return Boolean(this.accessToken);
        }

        getExpireInSeconds() {
            return 3600;
        }

        async setTokens() {}

        async notify() {}
    }

    return {
        OAuth2Requester,
        get: (obj, key, def) => {
            if (
                obj &&
                Object.prototype.hasOwnProperty.call(obj, key) &&
                obj[key] != null
            ) {
                return obj[key];
            }
            return def;
        },
    };
});

const axios = require('axios');
jest.mock('axios');

const {
    Api,
    DEFAULT_MINOR_VERSION,
    MINOR_VERSIONS_DOCS_URL,
} = require('../api');

describe('QBO minorversion pin', () => {
    beforeEach(() => {
        axios.mockReset();
        axios.mockResolvedValue({
            data: {CompanyInfo: {Id: '1', CompanyName: 'Acme'}},
        });
        axios.get = jest.fn().mockResolvedValue({data: {}});
        axios.post = jest.fn().mockResolvedValue({data: {}});
    });

    it('pins DEFAULT_MINOR_VERSION to 75 from Intuit docs', () => {
        expect(DEFAULT_MINOR_VERSION).toBe(75);
        expect(MINOR_VERSIONS_DOCS_URL).toContain('minor-versions');
    });

    it('configures node-quickbooks with the pinned minorversion', () => {
        const api = new Api({
            accessToken: 'tok',
            refreshToken: 'ref',
            realmId: '9130354628571476',
        });
        expect(api.minorversion).toBe(DEFAULT_MINOR_VERSION);
        expect(api.qbo.minorversion).toBe(DEFAULT_MINOR_VERSION);
        expect(api.qbo.qbo.minorversion).toBe(DEFAULT_MINOR_VERSION);
    });

    it('sends minorversion on Accounting API requests', async () => {
        const api = new Api({
            accessToken: 'tok',
            refreshToken: 'ref',
            realmId: '9130354628571476',
        });
        await api.getCompanyInfo();
        expect(axios).toHaveBeenCalled();
        const opts = axios.mock.calls[0][0];
        expect(opts.params.minorversion).toBe(DEFAULT_MINOR_VERSION);
    });
});
