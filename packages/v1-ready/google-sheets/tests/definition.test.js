const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

const userInfo = {
    id: '118220000000000000000',
    email: 'nicole@example.com',
    name: 'Nicole',
};

const stubApi = (details = userInfo) => ({
    getUserDetails: async () => details,
    getAuthorizationUri: () => 'https://accounts.google.com/o/oauth2/auth?x=1',
    getTokenFromCode: async (code) => ({ access_token: `tok-for-${code}` }),
});

describe('Google Sheets Definition', () => {
    it('names itself consistently with its config', () => {
        expect(Definition.getName()).toBe('google-sheets');
        expect(Definition.moduleName).toBe('google-sheets');
    });

    describe('getAuthorizationRequirements()', () => {
        it('declares oauth2 and hands back the consent URL', () => {
            const api = stubApi();
            const reqs = requiredAuthMethods.getAuthorizationRequirements.call({
                api,
            });
            expect(reqs).toEqual({
                url: 'https://accounts.google.com/o/oauth2/auth?x=1',
                type: 'oauth2',
            });
        });
    });

    describe('getToken()', () => {
        it('exchanges the code from params.data', async () => {
            const api = stubApi();
            const token = await requiredAuthMethods.getToken(api, {
                data: { code: 'abc123' },
            });
            expect(token).toEqual({ access_token: 'tok-for-abc123' });
        });

        it('throws rather than exchanging undefined when no code arrives', async () => {
            await expect(
                requiredAuthMethods.getToken(stubApi(), { data: {} })
            ).rejects.toThrow();
        });
    });

    describe('identity', () => {
        it('keys the entity on the Google account id, with the user id alongside', async () => {
            const result = await requiredAuthMethods.getEntityDetails(
                stubApi(),
                null,
                null,
                'user-123'
            );
            expect(result.identifiers).toEqual({
                externalId: userInfo.id,
                userId: 'user-123',
            });
            expect(result.details).toEqual({ name: userInfo.email });
        });

        it('getCredentialDetails agrees with getEntityDetails on the external id', async () => {
            // A disagreement here silently forks one Google account into two
            // credentials, and the second connection never finds the first.
            const entity = await requiredAuthMethods.getEntityDetails(
                stubApi(),
                null,
                null,
                'user-123'
            );
            const credential = await requiredAuthMethods.getCredentialDetails(
                stubApi(),
                'user-123'
            );
            expect(credential.identifiers).toEqual(entity.identifiers);
        });

        it('testAuthRequest resolves for a live token', async () => {
            await expect(
                requiredAuthMethods.testAuthRequest(stubApi())
            ).resolves.toEqual(userInfo);
        });

        it('testAuthRequest rejects when the token no longer works', async () => {
            const revoked = {
                getUserDetails: async () => {
                    throw new Error('401 invalid_token');
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(revoked)
            ).rejects.toThrow(/invalid_token/);
        });
    });

    describe('apiPropertiesToPersist', () => {
        it('persists the refresh token — it is only issued once, on first consent', () => {
            expect(
                requiredAuthMethods.apiPropertiesToPersist.credential
            ).toContain('refresh_token');
        });

        it('persists the granted scope, so a downgrade is detectable', () => {
            // Google honours incremental auth: a later grant can come back with
            // fewer scopes than asked for, and the only evidence is here.
            expect(
                requiredAuthMethods.apiPropertiesToPersist.credential
            ).toContain('scope');
        });
    });
});
