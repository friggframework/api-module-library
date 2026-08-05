const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

const activeSelf = {
    active: true,
    workspace_id: 'e5f0c9a2-1b3d-4a7e-9c8f-0d1e2f3a4b5c',
    workspace_name: 'Test Workspace',
    workspace_slug: 'test-workspace',
};

const revokedSelf = { active: false };

function makeStubApi(userDetails) {
    return {
        getUserDetails: async () => userDetails,
    };
}

describe('Attio Definition', () => {
    describe('testAuthRequest()', () => {
        it('resolves with the self payload for an active token', async () => {
            const api = makeStubApi(activeSelf);

            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).resolves.toEqual(activeSelf);
        });

        it('rejects when Attio reports the token as inactive', async () => {
            const api = makeStubApi(revokedSelf);

            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/not active/i);
        });

        it('rejects when the self payload omits the active member', async () => {
            const api = makeStubApi({ workspace_id: 'no-active-member' });

            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/not active/i);
        });

        it('rejects when the self payload is empty', async () => {
            const api = makeStubApi(undefined);

            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/not active/i);
        });
    });

    describe('getCredentialDetails()', () => {
        it('returns the workspace identifiers for an active token', async () => {
            const api = makeStubApi(activeSelf);

            const result = await requiredAuthMethods.getCredentialDetails(
                api,
                'user-123'
            );

            expect(result.identifiers).toEqual({
                externalId: activeSelf.workspace_id,
                userId: 'user-123',
            });
        });

        it('rejects for a revoked token, which carries no workspace_id', async () => {
            const api = makeStubApi(revokedSelf);

            await expect(
                requiredAuthMethods.getCredentialDetails(api, 'user-123')
            ).rejects.toThrow(/workspace info/i);
        });
    });

    describe('getEntityDetails()', () => {
        it('rejects for a revoked token, which carries no workspace_id', async () => {
            const api = makeStubApi(revokedSelf);

            await expect(
                requiredAuthMethods.getEntityDetails(api, null, null, 'user-123')
            ).rejects.toThrow(/workspace info/i);
        });
    });
});
