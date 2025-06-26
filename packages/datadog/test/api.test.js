const { Api } = require('../api');
const { Definition } = require('../definition');

describe('Datadog API Tests', () => {
    let api;

    beforeAll(() => {
        api = new Api({
            apiKey: process.env.DATADOG_API_KEY || 'test-key',
            applicationKey: process.env.DATADOG_APPLICATION_KEY || 'test-app-key'
        });
    });

    describe('Validation', () => {
        test('should validate API key', async () => {
            // Mock the validation endpoint
            const validation = await api.validateApiKey();
            expect(validation).toBeDefined();
        });
    });

    describe('Metrics', () => {
        test('should submit metrics', async () => {
            const metrics = {
                series: [{
                    metric: 'test.metric',
                    points: [[Date.now() / 1000, 1]],
                    tags: ['test:true']
                }]
            };
            
            const result = await api.submitMetrics(metrics);
            expect(result).toBeDefined();
        });
    });

    describe('Events', () => {
        test('should create event', async () => {
            const event = {
                title: 'Test Event',
                text: 'This is a test event',
                tags: ['test:event']
            };
            
            const result = await api.createEvent(event);
            expect(result).toBeDefined();
        });

        test('should list events', async () => {
            const events = await api.listEvents({ start: Date.now() - 86400 });
            expect(Array.isArray(events) || events.events).toBeTruthy();
        });
    });
});
