/**
 * Definition unit tests — assert the shape of identifiers handed to
 * Frigg core during the auth handshake. The Postgres schema in
 * @friggframework/core ≥ 2.0.0-next types Credential.externalId as
 * String?, so portalId (Int from HubSpot's /access-tokens response)
 * must be stringified at the api-module boundary.
 */

const { Definition } = require('../definition');

const baseUserDetails = {
    portalId: 111111111, // HubSpot returns this as an integer
    hub_domain: 'Testing Object Things-dev-44613847.com',
    hub_id: 111111111,
};

function makeStubApi(userDetailsOverride = {}) {
    return {
        getUserDetails: async () =>
            Object.assign({}, baseUserDetails, userDetailsOverride),
    };
}

describe('HubSpot Definition externalId coercion', () => {
    describe('getEntityDetails()', () => {
        it('returns externalId as a string, not an integer', async () => {
            const api = makeStubApi();
            const result =
                await Definition.requiredAuthMethods.getEntityDetails(
                    api,
                    null,
                    null,
                    42
                );

            expect(typeof result.identifiers.externalId).toBe('string');
            expect(result.identifiers.externalId).toBe('111111111');
        });

        it('stringifies a very large portalId without losing precision', async () => {
            const api = makeStubApi({ portalId: 9999999999 });
            const result =
                await Definition.requiredAuthMethods.getEntityDetails(
                    api,
                    null,
                    null,
                    42
                );

            expect(result.identifiers.externalId).toBe('9999999999');
        });
    });

    describe('getCredentialDetails()', () => {
        it('returns externalId as a string, not an integer', async () => {
            const api = makeStubApi();
            const result =
                await Definition.requiredAuthMethods.getCredentialDetails(
                    api,
                    42
                );

            expect(typeof result.identifiers.externalId).toBe('string');
            expect(result.identifiers.externalId).toBe('111111111');
        });
    });
});
