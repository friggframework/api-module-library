const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Fathom Authentication Tests', () => {
    const mockApiKey = process.env.FATHOM_API_KEY || 'test-api-key';
    
    describe('getAuthorizationRequirements', () => {
        it('Should return correct auth requirements', async () => {
            const requirements = await Definition.requiredAuthMethods.getAuthorizationRequirements();
            
            expect(requirements).toBeDefined();
            expect(requirements.type).toBe('api_key');
            expect(requirements.fields).toBeInstanceOf(Array);
            expect(requirements.fields.length).toBe(1);
            
            const apiKeyField = requirements.fields[0];
            expect(apiKeyField.key).toBe('apiKey');
            expect(apiKeyField.label).toBe('API Key');
            expect(apiKeyField.type).toBe('password');
            expect(apiKeyField.required).toBe(true);
            expect(apiKeyField.helpText).toBeDefined();
        });
    });

    describe('setAuthParams', () => {
        it('Should set API key correctly', async () => {
            const api = new Api({});
            const params = { apiKey: mockApiKey };
            
            await Definition.requiredAuthMethods.setAuthParams(api, params);
            
            expect(api.apiKey).toBe(mockApiKey);
            expect(api.access_token).toBe(mockApiKey);
        });
    });

    describe('getEntityDetails', () => {
        it('Should return entity details structure', async () => {
            const api = new Api({ apiKey: mockApiKey });
            
            // Mock the listTeams method
            api.listTeams = jest.fn().mockResolvedValue({
                data: [{
                    id: 'team-123',
                    name: 'Test Team'
                }]
            });
            
            const entityDetails = await Definition.requiredAuthMethods.getEntityDetails(api);
            
            expect(entityDetails).toBeDefined();
            expect(entityDetails.identifiers).toBeDefined();
            expect(entityDetails.identifiers.externalId).toBe('team-123');
            expect(entityDetails.details).toBeDefined();
            expect(entityDetails.details.name).toBe('Test Team');
            expect(entityDetails.details.team).toBeDefined();
        });

        it('Should handle no teams case', async () => {
            const api = new Api({ apiKey: mockApiKey });
            
            // Mock empty teams response
            api.listTeams = jest.fn().mockResolvedValue({
                data: []
            });
            
            const entityDetails = await Definition.requiredAuthMethods.getEntityDetails(api);
            
            expect(entityDetails.identifiers.externalId).toBe('default');
            expect(entityDetails.details.name).toBe('Fathom User');
        });
    });

    describe('apiPropertiesToPersist', () => {
        it('Should define properties to persist', () => {
            const properties = Definition.requiredAuthMethods.apiPropertiesToPersist;
            
            expect(properties).toBeDefined();
            expect(properties.credential).toEqual(['apiKey']);
            expect(properties.entity).toEqual([]);
        });
    });

    describe('getCredentialDetails', () => {
        it('Should return credential details', async () => {
            const api = new Api({ apiKey: mockApiKey });
            
            // Mock the listTeams method
            api.listTeams = jest.fn().mockResolvedValue({
                data: [{
                    id: 'team-123',
                    name: 'Test Team'
                }]
            });
            
            const credentialDetails = await Definition.requiredAuthMethods.getCredentialDetails(api);
            
            expect(credentialDetails).toBeDefined();
            expect(credentialDetails.identifiers.externalId).toBe('team-123');
            expect(credentialDetails.details.authenticated).toBe(true);
            expect(credentialDetails.details.teamName).toBe('Test Team');
        });
    });

    describe('testAuthRequest', () => {
        it('Should validate authentication successfully', async () => {
            const api = new Api({ apiKey: mockApiKey });
            
            // Mock successful response
            api.listTeams = jest.fn().mockResolvedValue({
                data: []
            });
            
            const result = await Definition.requiredAuthMethods.testAuthRequest(api);
            expect(result).toBe(true);
        });

        it('Should throw error for invalid API key', async () => {
            const api = new Api({ apiKey: 'invalid-key' });
            
            // Mock 401 error
            api.listTeams = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));
            
            await expect(Definition.requiredAuthMethods.testAuthRequest(api))
                .rejects.toThrow('Invalid API key');
        });

        it('Should propagate other errors', async () => {
            const api = new Api({ apiKey: mockApiKey });
            
            // Mock generic error
            const genericError = new Error('Network error');
            api.listTeams = jest.fn().mockRejectedValue(genericError);
            
            await expect(Definition.requiredAuthMethods.testAuthRequest(api))
                .rejects.toThrow('Network error');
        });
    });

    describe('Module Configuration', () => {
        it('Should have correct module name', () => {
            expect(Definition.getName()).toBe('fathom');
            expect(Definition.moduleName).toBe('fathom');
        });

        it('Should have API class defined', () => {
            expect(Definition.API).toBe(Api);
        });

        it('Should have environment variable mapping', () => {
            expect(Definition.env).toBeDefined();
            expect(Definition.env.apiKey).toBe(process.env.FATHOM_API_KEY);
        });
    });
});