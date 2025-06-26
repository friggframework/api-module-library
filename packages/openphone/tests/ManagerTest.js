const { Api } = require('../api');
const { Definition } = require('../definition');

class OpenproneMockApi {
    constructor() {
        this.baseUrl = 'https://api.openphone.com';
    }

    // Mock methods for testing
    async getCalls() {
        return { data: [] };
    }

    async getMessages() {
        return { data: [] };
    }

    async getContacts() {
        return { data: [] };
    }

    async getCurrentUser() {
        return { data: { id: '123', name: 'Test User' } };
    }
}

beforeAll(async () => {
    this.api = new Api({
        api_key: process.env.OPENPHONE_API_KEY,
    });
});

afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
});

describe('OpenPhone Manager', () => {
    it('should initialize', async () => {
        expect(this.api).toBeDefined();
        expect(this.api.baseUrl).toBe('https://api.openphone.com');
    });

    describe('API Methods', () => {
        it('should have getCalls method', () => {
            expect(typeof this.api.getCalls).toBe('function');
        });

        it('should have getMessages method', () => {
            expect(typeof this.api.getMessages).toBe('function');
        });

        it('should have getContacts method', () => {
            expect(typeof this.api.getContacts).toBe('function');
        });

        it('should have getCurrentUser method', () => {
            expect(typeof this.api.getCurrentUser).toBe('function');
        });
    });
});

describe('OpenPhone Definition', () => {
    it('should have correct module name', () => {
        expect(Definition.moduleName).toBe('openphone');
        expect(Definition.getName()).toBe('openphone');
    });

    it('should have API class', () => {
        expect(Definition.API).toBe(Api);
    });

    it('should have model name', () => {
        expect(Definition.modelName).toBe('OpenPhone');
    });
}); 