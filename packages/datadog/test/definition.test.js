const { Definition } = require('../definition');

describe('Datadog Definition Tests', () => {
    test('should create definition with required fields', () => {
        const params = {
            id: 'test-id',
            userId: 'test-user',
            apiKey: 'test-key',
            applicationKey: 'test-app-key'
        };
        
        const definition = new Definition(params);
        
        expect(definition.id).toBe(params.id);
        expect(definition.userId).toBe(params.userId);
        expect(definition.apiKey).toBe(params.apiKey);
        expect(definition.applicationKey).toBe(params.applicationKey);
    });

    test('should have correct config', () => {
        expect(Definition.Config.name).toBe('datadog');
        expect(Definition.Config.authType).toBe('apiKey');
    });
});
