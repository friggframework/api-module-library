const { Definition } = require('../definition');

describe('ClientSuccess Definition', () => {
    test('should have required properties', () => {
        expect(Definition).toBeDefined();
        expect(Definition.API).toBeDefined();
        expect(Definition.getName).toBeDefined();
        expect(Definition.moduleName).toBeDefined();
        expect(Definition.requiredAuthMethods).toBeDefined();
    });

    test('getName should return module name', () => {
        const name = Definition.getName();
        expect(name).toBe('clientsuccess');
    });

    test('should have required auth methods', () => {
        const { requiredAuthMethods } = Definition;
        expect(requiredAuthMethods.getToken).toBeDefined();
        expect(requiredAuthMethods.getEntityDetails).toBeDefined();
        expect(requiredAuthMethods.getCredentialDetails).toBeDefined();
        expect(requiredAuthMethods.testAuthRequest).toBeDefined();
    });
});
