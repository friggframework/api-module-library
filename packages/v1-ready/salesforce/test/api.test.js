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

    const mockRefreshToken = jest.fn();

    return {
        OAuth2: jest.fn().mockImplementation((params) => ({
            getAuthorizationUrl: mockGetAuthorizationUrl,
            refreshToken: mockRefreshToken,
            codeVerifier: params?.useVerifier ? 'test-code-verifier' : undefined,
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
    scope: 'full refresh_token',
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

        it('does not subscribe to the jsforce refresh event', () => {
            expect(api.conn.on).not.toHaveBeenCalledWith(
                'refresh',
                expect.any(Function)
            );
        });
    });
});

describe('getAuthorizationUri state handling', () => {
    const stateOf = (url) =>
        new URL(url).searchParams.get('state');

    it('preserves the caller state and appends the encrypted verifier', () => {
        const api = new Api({ ...baseParams, state: 'testfirma.NONCE123' });
        const state = stateOf(api.getAuthorizationUri());
        expect(state.startsWith('testfirma.NONCE123')).toBe(true);
        expect(state).not.toBe('testfirma.NONCE123');
    });

    it('keeps the caller state parseable by a first-dot split', () => {
        const api = new Api({ ...baseParams, state: 'testfirma.NONCE123' });
        const state = stateOf(api.getAuthorizationUri());
        expect(state.split('.', 1)[0]).toBe('testfirma');
    });

    it('round-trips the verifier out of the composed state', () => {
        const api = new Api({ ...baseParams, state: 'testfirma.NONCE123' });
        const state = stateOf(api.getAuthorizationUri());
        api.restoreVerifierFromState(state);
        expect(api.oauth2.codeVerifier).toBe('test-code-verifier');
    });

    it('emits the bare encrypted verifier when the caller supplied no state', () => {
        const api = new Api(baseParams);
        const state = stateOf(api.getAuthorizationUri());
        expect(state).toBeTruthy();
        api.restoreVerifierFromState(state);
        expect(api.oauth2.codeVerifier).toBe('test-code-verifier');
    });

    it('still restores from a legacy state that carries only the verifier', () => {
        const api = new Api(baseParams);
        const legacy = api._encryptVerifier('test-code-verifier');
        api.restoreVerifierFromState(legacy);
        expect(api.oauth2.codeVerifier).toBe('test-code-verifier');
    });
});

describe('Salesforce Api token refresh', () => {
    const rotated = {
        access_token: 'at-new',
        refresh_token: 'rt-new',
        instance_url: 'https://new.my.salesforce.com',
    };

    const tokenEndpointError = (name, message) =>
        Object.assign(new Error(message), { name });
    const invalidGrant = () =>
        tokenEndpointError('invalid_grant', 'expired access/refresh token');
    const invalidClientId = () =>
        tokenEndpointError('invalid_client_id', 'client identifier invalid');
    const http503 = () =>
        tokenEndpointError('ERROR_HTTP_503', '<html>maintenance</html>');

    function makeApi({ stored, backoff = [] } = {}) {
        const store = { current: stored };
        const receiveNotification = jest.fn(async (_notifier, type) =>
            type === 'CREDENTIAL_RELOAD' ? store.current : undefined
        );
        const api = new Api({
            ...baseParams,
            access_token: 'at-old',
            refresh_token: 'rt-old',
            instanceUrl: 'https://old.my.salesforce.com',
            credentialReloadBackoffMs: backoff,
            delegate: { ...baseParams.delegate, receiveNotification },
        });
        Object.assign(api.conn, {
            accessToken: 'at-old',
            refreshToken: 'rt-old',
            instanceUrl: 'https://old.my.salesforce.com',
        });
        api.oauth2.refreshToken.mockReset();
        return { api, store, receiveNotification };
    }

    const jsforceRefresh = (api) => {
        const { refreshFn } =
            require('jsforce').Connection.mock.calls.at(-1)[0];
        return new Promise((resolve) =>
            refreshFn(api.conn, (err, accessToken) =>
                resolve({ err, accessToken })
            )
        );
    };

    const notified = (spy, type) =>
        spy.mock.calls.filter(([, t]) => t === type);

    let logSpy;
    let warnSpy;
    let errorSpy;
    const consoleOutput = () =>
        JSON.stringify(
            [logSpy, warnSpy, errorSpy].map((spy) => spy.mock.calls)
        );

    beforeEach(() => {
        jest.clearAllMocks();
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('persists the rotated refresh token on a jsforce refresh', async () => {
        const { api, receiveNotification } = makeApi();
        api.oauth2.refreshToken.mockResolvedValue(rotated);

        const { err, accessToken } = await jsforceRefresh(api);

        expect(err).toBeUndefined();
        expect(accessToken).toBe('at-new');
        expect(api.refresh_token).toBe('rt-new');
        expect(api.access_token).toBe('at-new');
        expect(api.conn.refreshToken).toBe('rt-new');
        expect(api.conn.accessToken).toBe('at-new');
        expect(notified(receiveNotification, 'TOKEN_UPDATE')).toHaveLength(1);
    });

    it('adopts a newer stored credential instead of calling the token endpoint', async () => {
        const { api, receiveNotification } = makeApi({
            stored: { access_token: 'at-db', refresh_token: 'rt-db' },
        });

        const { err, accessToken } = await jsforceRefresh(api);

        expect(err).toBeUndefined();
        expect(accessToken).toBe('at-db');
        expect(api.oauth2.refreshToken).not.toHaveBeenCalled();
        expect(api.conn.refreshToken).toBe('rt-db');
        expect(api.conn.accessToken).toBe('at-db');
        expect(notified(receiveNotification, 'TOKEN_UPDATE')).toHaveLength(0);
    });

    it('notifies INVALID_AUTH when Salesforce rejects the grant and nothing newer is stored', async () => {
        const { api, receiveNotification } = makeApi({
            stored: { access_token: 'at-old', refresh_token: 'rt-old' },
        });
        api.oauth2.refreshToken.mockRejectedValue(invalidGrant());

        const { err } = await jsforceRefresh(api);

        expect(err).toBeDefined();
        expect(err.message).toBe('Salesforce rejected the refresh token');
        expect(notified(receiveNotification, 'INVALID_AUTH')).toHaveLength(1);
        expect(notified(receiveNotification, 'TOKEN_UPDATE')).toHaveLength(0);
        expect(api.conn.refreshToken).toBe('rt-old');
    });

    it('fails the refresh without invalidating on a token-endpoint transport error', async () => {
        const { api, receiveNotification } = makeApi();
        api.oauth2.refreshToken.mockRejectedValue(http503());

        const { err } = await jsforceRefresh(api);

        expect(err.isTokenRefreshTransportFailure).toBe(true);
        expect(err.statusCode).toBe(503);
        expect(notified(receiveNotification, 'INVALID_AUTH')).toHaveLength(0);
    });

    it('classifies invalid_client_id as a definitive rejection', async () => {
        const { api, receiveNotification } = makeApi({
            stored: { access_token: 'at-old', refresh_token: 'rt-old' },
        });
        api.oauth2.refreshToken.mockRejectedValue(invalidClientId());

        await jsforceRefresh(api);

        const invalidations = notified(receiveNotification, 'INVALID_AUTH');
        expect(invalidations).toHaveLength(1);
        expect(invalidations[0][2]).toEqual({ statusCode: 400 });
        expect(notified(receiveNotification, 'TOKEN_UPDATE')).toHaveLength(0);
    });

    it('adopts the credential another worker wrote after Salesforce rejects the grant', async () => {
        const { api, store, receiveNotification } = makeApi({
            stored: { access_token: 'at-old', refresh_token: 'rt-old' },
            backoff: [0],
        });
        api.oauth2.refreshToken.mockImplementation(async () => {
            store.current = { access_token: 'at-db', refresh_token: 'rt-db' };
            throw invalidGrant();
        });

        const { err, accessToken } = await jsforceRefresh(api);

        expect(err).toBeUndefined();
        expect(accessToken).toBe('at-db');
        expect(api.conn.refreshToken).toBe('rt-db');
        expect(notified(receiveNotification, 'INVALID_AUTH')).toHaveLength(0);
    });

    it('after a definitive rejection only re-reads the store on later refreshes', async () => {
        const { api, store, receiveNotification } = makeApi({
            stored: { access_token: 'at-old', refresh_token: 'rt-old' },
        });
        api.oauth2.refreshToken.mockRejectedValue(invalidGrant());
        await jsforceRefresh(api);
        api.oauth2.refreshToken.mockClear();
        receiveNotification.mockClear();

        const second = await jsforceRefresh(api);

        expect(second.err).toBeDefined();
        expect(api.oauth2.refreshToken).not.toHaveBeenCalled();
        expect(notified(receiveNotification, 'CREDENTIAL_RELOAD')).toHaveLength(
            1
        );
        expect(notified(receiveNotification, 'INVALID_AUTH')).toHaveLength(0);

        store.current = { access_token: 'at-db', refresh_token: 'rt-db' };
        const third = await jsforceRefresh(api);

        expect(third.err).toBeUndefined();
        expect(third.accessToken).toBe('at-db');
        expect(api.conn.refreshToken).toBe('rt-db');
        expect(api.oauth2.refreshToken).not.toHaveBeenCalled();
    });

    it('resetToSandbox keeps the refresh hook on the new connection', async () => {
        const { api } = makeApi();
        api.resetToSandbox();
        Object.assign(api.conn, {
            accessToken: 'at-old',
            refreshToken: 'rt-old',
        });
        api.oauth2.refreshToken.mockResolvedValue(rotated);

        const { err, accessToken } = await jsforceRefresh(api);

        expect(err).toBeUndefined();
        expect(accessToken).toBe('at-new');
        expect(api.refresh_token).toBe('rt-new');
        expect(api.conn.refreshToken).toBe('rt-new');
    });

    it('refreshes through jsforce when core calls refreshAuth()', async () => {
        const { api, receiveNotification } = makeApi();
        api.oauth2.refreshToken.mockResolvedValue(rotated);

        await expect(api.refreshAuth()).resolves.toBe(true);

        expect(api.oauth2.refreshToken).toHaveBeenCalledWith('rt-old');
        expect(api.access_token).toBe('at-new');
        expect(api.conn.accessToken).toBe('at-new');
        expect(notified(receiveNotification, 'TOKEN_UPDATE')).toHaveLength(1);
    });

    it('persists a token response the caller already obtained without refreshing', async () => {
        const { api, receiveNotification } = makeApi();

        await api.refreshAccessToken(rotated);

        expect(api.oauth2.refreshToken).not.toHaveBeenCalled();
        expect(api.refresh_token).toBe('rt-new');
        expect(api.conn.refreshToken).toBe('rt-new');
        expect(api.instanceUrl).toBe('https://old.my.salesforce.com');
        expect(notified(receiveNotification, 'TOKEN_UPDATE')).toHaveLength(1);
    });

    it('does not move the credential instance URL on refresh', async () => {
        const { api } = makeApi();
        api.oauth2.refreshToken.mockResolvedValue(rotated);

        await jsforceRefresh(api);

        expect(api.instanceUrl).toBe('https://old.my.salesforce.com');
        expect(api.conn.instanceUrl).toBe('https://old.my.salesforce.com');
    });

    it('hands jsforce the token only after the credential write has been awaited', async () => {
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const { api, receiveNotification } = makeApi();
        receiveNotification.mockImplementation(async (_notifier, type) => {
            if (type === 'TOKEN_UPDATE') await gate;
            return undefined;
        });
        api.oauth2.refreshToken.mockResolvedValue(rotated);
        const callback = jest.fn();
        const { refreshFn } =
            require('jsforce').Connection.mock.calls.at(-1)[0];

        refreshFn(api.conn, callback);
        await new Promise(setImmediate);
        expect(callback).not.toHaveBeenCalled();

        release();
        await new Promise(setImmediate);
        expect(callback).toHaveBeenCalledWith(undefined, 'at-new');
    });

    it('keeps the stored refresh token when Salesforce does not rotate', async () => {
        const { api } = makeApi();
        api.oauth2.refreshToken.mockResolvedValue({
            access_token: 'at-new',
            instance_url: rotated.instance_url,
        });

        const { accessToken } = await jsforceRefresh(api);

        expect(accessToken).toBe('at-new');
        expect(api.refresh_token).toBe('rt-old');
        expect(api.conn.refreshToken).toBe('rt-old');
    });

    it('does not write tokens to the console on a successful refresh', async () => {
        const { api } = makeApi();
        api.oauth2.refreshToken.mockResolvedValue(rotated);

        await jsforceRefresh(api);

        expect(consoleOutput()).not.toMatch(/at-new|rt-new|at-old|rt-old/);
    });

    it('does not write tokens to the console on a rejected refresh', async () => {
        const { api } = makeApi({
            stored: { access_token: 'at-old', refresh_token: 'rt-old' },
        });
        api.oauth2.refreshToken.mockRejectedValue(invalidGrant());

        await jsforceRefresh(api);

        expect(consoleOutput()).not.toMatch(/at-new|rt-new|at-old|rt-old/);
    });
});
