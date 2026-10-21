const { Definition } = require('../definition');

describe('Salesforce Definition', () => {
    const { requiredAuthMethods } = Definition;

    describe('getAuthorizationRequirements', () => {
        it('should be synchronous (not return a Promise)', () => {
            const mockApi = {
                getAuthorizationUri: () => 'https://login.salesforce.com/auth',
            };
            const context = { api: mockApi };

            const result = requiredAuthMethods.getAuthorizationRequirements.call(context);
            expect(result).not.toBeInstanceOf(Promise);
        });

        it('should return type oauth2 and a url', () => {
            const mockApi = {
                getAuthorizationUri: () => 'https://login.salesforce.com/auth?scope=full+refresh_token',
            };
            const context = { api: mockApi };

            const result = requiredAuthMethods.getAuthorizationRequirements.call(context);
            expect(result.type).toBe('oauth2');
            expect(result.url).toBe('https://login.salesforce.com/auth?scope=full+refresh_token');
        });
    });

    describe('getToken', () => {
        it('should extract code from params directly (not params.data)', async () => {
            const capturedArgs = {};
            const mockApi = {
                getAccessToken: jest.fn().mockImplementation((code) => {
                    capturedArgs.code = code;
                    return Promise.resolve('access-token');
                }),
            };

            await requiredAuthMethods.getToken(mockApi, { code: 'test-code' });
            expect(capturedArgs.code).toBe('test-code');
        });

        it('should throw when code is nested under params.data instead of params', async () => {
            const mockApi = {
                getAccessToken: jest.fn().mockResolvedValue('access-token'),
                resetToSandbox: jest.fn(),
            };

            // Passing code nested under data — get(params, 'code') throws RequiredPropertyError
            await expect(
                requiredAuthMethods.getToken(mockApi, { data: { code: 'test-code' } })
            ).rejects.toThrow('code');
        });

        it('should fall back to sandbox and retry on auth failure', async () => {
            const mockApi = {
                getAccessToken: jest.fn()
                    .mockRejectedValueOnce(new Error('Auth failed'))
                    .mockResolvedValueOnce('access-token'),
                resetToSandbox: jest.fn(),
            };

            const result = await requiredAuthMethods.getToken(mockApi, { code: 'test-code' });
            expect(mockApi.resetToSandbox).toHaveBeenCalledTimes(1);
            expect(mockApi.getAccessToken).toHaveBeenCalledTimes(2);
            expect(result).toBe('access-token');
        });
    });

    describe('getCredentialDetails', () => {
        it('should use externalId as the identifier key', async () => {
            const mockApi = { instanceUrl: 'https://myorg.salesforce.com' };

            const result = await requiredAuthMethods.getCredentialDetails(mockApi, 'user-123');
            expect(result.identifiers).toHaveProperty('externalId', 'https://myorg.salesforce.com');
            expect(result.identifiers).not.toHaveProperty('instanceUrl');
        });

        it('should include userId in identifiers', async () => {
            const mockApi = { instanceUrl: 'https://myorg.salesforce.com' };

            const result = await requiredAuthMethods.getCredentialDetails(mockApi, 'user-456');
            expect(result.identifiers.userId).toBe('user-456');
        });
    });

    describe('apiPropertiesToPersist', () => {
        it('should persist refresh_token', () => {
            expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain('refresh_token');
        });

        it('should persist access_token', () => {
            expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain('access_token');
        });

        it('should persist instanceUrl', () => {
            expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain('instanceUrl');
        });
    });
});
