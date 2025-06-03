// Test setup file for Recharge API tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.RECHARGE_API_KEY = 'test-api-key-123456789';
process.env.REDIRECT_URI = 'https://example.com/oauth/callback';

// Mock console methods to reduce noise in test output
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Mock timers for testing rate limiting and retries
jest.useFakeTimers();

// Add custom matchers
expect.extend({
    toBeValidDate(received: string) {
        const date = new Date(received);
        const pass = !isNaN(date.getTime());
        return {
            pass,
            message: () => 
                pass
                    ? `expected ${received} not to be a valid date`
                    : `expected ${received} to be a valid date`
        };
    },
    toBeValidUrl(received: string) {
        let url: URL;
        try {
            url = new URL(received);
        } catch {
            return {
                pass: false,
                message: () => `expected ${received} to be a valid URL`
            };
        }
        return {
            pass: true,
            message: () => `expected ${received} not to be a valid URL`
        };
    }
});

// Extend Jest matchers TypeScript definitions
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidDate(): R;
            toBeValidUrl(): R;
        }
    }
}

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});