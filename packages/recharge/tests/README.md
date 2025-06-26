# Recharge API Module Tests

This directory contains comprehensive tests for the Recharge API module.

## Test Structure

```
tests/
├── api.test.ts           # Unit tests for API methods
├── integration.test.ts   # Integration tests with mocked HTTP
├── fixtures/
│   └── mockData.ts      # Mock data and test fixtures
├── helpers/
│   └── testUtils.ts     # Test utilities and helpers
├── jest.config.js       # Jest configuration
├── setup.ts            # Test environment setup
├── runTests.sh         # Test runner script
└── README.md           # This file
```

## Running Tests

### Prerequisites

Install test dependencies:
```bash
npm install --save-dev jest ts-jest @types/jest nock @types/node typescript
```

### Run All Tests

```bash
# Using the test script
./runTests.sh

# Or using npm/jest directly
npx jest
```

### Run Specific Test Suites

```bash
# Unit tests only
npx jest api.test.ts

# Integration tests only
npx jest integration.test.ts

# With coverage
npx jest --coverage
```

### Watch Mode

```bash
npx jest --watch
```

## Test Coverage

The test suite aims for comprehensive coverage of:

### Unit Tests (api.test.ts)
- Constructor and initialization
- Authentication header management
- All API endpoint methods
- Error handling
- Parameter validation
- Helper methods

### Integration Tests (integration.test.ts)
- Full request/response cycles
- Error response handling
- Pagination
- Authentication flow
- CRUD operations for all resources
- Webhook management
- Bulk operations

## Mock Data

The `fixtures/mockData.ts` file provides:
- Mock responses for all API resources
- Error response mocks
- Helper functions to generate test data
- Pagination metadata

## Test Utilities

The `helpers/testUtils.ts` file provides:
- Test API instance creation
- Nock interceptor management
- Response builders
- Header validation
- Common test patterns

## Environment Variables

Set these for testing:
- `RECHARGE_API_KEY`: API key for testing (defaults to mock key)
- `NODE_ENV`: Set to 'test'

## Writing New Tests

### Unit Test Example

```typescript
describe('New endpoint', () => {
    it('Should call _get with proper URL', async () => {
        const mockResponse = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(mockResponse);
        
        const response = await api.newEndpoint();
        
        expect(api._get).toHaveBeenCalledWith({
            url: `${api.baseUrl}/new-endpoint`
        });
        expect(response).toEqual(mockResponse);
    });
});
```

### Integration Test Example

```typescript
describe('New endpoint integration', () => {
    it('Should handle full request cycle', async () => {
        const mockResponse = { data: 'test' };
        
        nock(baseUrl)
            .get('/new-endpoint')
            .matchHeader(expectAuthHeaders)
            .reply(200, mockResponse);
        
        const response = await api.newEndpoint();
        expect(response).toEqual(mockResponse);
    });
});
```

## Debugging Tests

### Enable console output
Comment out console mocks in `setup.ts` to see logs.

### Run specific test
```bash
npx jest -t "test name pattern"
```

### Debug in VS Code
Add breakpoints and use the Jest extension or debug configuration.

## Common Issues

### Nock not intercepting requests
- Ensure `nock.cleanAll()` is called in `beforeEach`
- Check that the URL and headers match exactly
- Verify that real network requests are disabled

### Type errors
- Ensure TypeScript is configured properly
- Check that all dependencies have type definitions
- Use proper type imports from the API module

### Timeout errors
- Increase test timeout in `setup.ts`
- Check for unresolved promises
- Ensure async operations complete properly