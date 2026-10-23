const {
    Api,
    resolveHosts,
    PRODUCTION_HOSTS,
    SANDBOX_HOSTS,
} = require('../api');

const baseParams = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uri: 'https://example.com/redirect/deel',
    scope: 'organizations:read',
};

describe('Deel host selection (offline)', () => {
    const originalEnv = process.env.DEEL_ENVIRONMENT;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.DEEL_ENVIRONMENT;
        } else {
            process.env.DEEL_ENVIRONMENT = originalEnv;
        }
    });

    describe('resolveHosts', () => {
        it('defaults to production hosts', () => {
            delete process.env.DEEL_ENVIRONMENT;
            expect(resolveHosts({})).toEqual(PRODUCTION_HOSTS);
        });

        it('selects sandbox hosts when environment param is sandbox', () => {
            expect(resolveHosts({environment: 'sandbox'})).toEqual(
                SANDBOX_HOSTS
            );
        });

        it('selects sandbox hosts when DEEL_ENVIRONMENT=sandbox', () => {
            process.env.DEEL_ENVIRONMENT = 'sandbox';
            expect(resolveHosts({})).toEqual(SANDBOX_HOSTS);
        });

        it('prefers explicit params.environment over DEEL_ENVIRONMENT', () => {
            process.env.DEEL_ENVIRONMENT = 'sandbox';
            expect(resolveHosts({environment: 'production'})).toEqual(
                PRODUCTION_HOSTS
            );
        });
    });

    describe('Api constructor defaults (production)', () => {
        beforeEach(() => {
            delete process.env.DEEL_ENVIRONMENT;
        });

        it('uses production API baseUrl', () => {
            const api = new Api(baseParams);
            expect(api.environment).toBe('production');
            expect(api.baseUrl).toBe('https://api.letsdeel.com/rest/v1');
            expect(api.URLs.organizations).toBe(
                'https://api.letsdeel.com/rest/v1/organizations'
            );
        });

        it('uses production OAuth authorize and token URLs', () => {
            const api = new Api(baseParams);
            expect(api.tokenUri).toBe('https://app.deel.com/oauth2/tokens');
            const authUri = new URL(api.authorizationUri);
            expect(authUri.origin).toBe('https://app.deel.com');
            expect(authUri.pathname).toBe('/oauth2/authorize');
            expect(authUri.searchParams.get('response_type')).toBe('code');
            expect(authUri.searchParams.get('client_id')).toBe(
                baseParams.client_id
            );
            expect(authUri.searchParams.get('redirect_uri')).toBe(
                baseParams.redirect_uri
            );
            expect(authUri.searchParams.get('scope')).toBe(baseParams.scope);
        });
    });

    describe('Api constructor sandbox opt-in', () => {
        it('uses sandbox hosts when environment=sandbox', () => {
            const api = new Api({...baseParams, environment: 'sandbox'});
            expect(api.environment).toBe('sandbox');
            expect(api.baseUrl).toBe(
                'https://api-staging.letsdeel.com/rest/v1'
            );
            expect(api.tokenUri).toBe(
                'https://app-sandbox.letsdeel.com/oauth/token'
            );
            const authUri = new URL(api.authorizationUri);
            expect(authUri.origin).toBe('https://app-sandbox.letsdeel.com');
            expect(authUri.pathname).toBe('/oauth/authorize');
        });

        it('uses sandbox hosts when DEEL_ENVIRONMENT=sandbox', () => {
            process.env.DEEL_ENVIRONMENT = 'sandbox';
            const api = new Api(baseParams);
            expect(api.environment).toBe('sandbox');
            expect(api.baseUrl).toBe(
                'https://api-staging.letsdeel.com/rest/v1'
            );
        });
    });
});
