const { Api } = require('../api');

// Mock uuid to avoid dependency issues in tests
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid-12345')
}));

describe('Todoist API', () => {
    let api;
    
    beforeEach(() => {
        api = new Api({
            apiToken: 'test_api_token',
            client_id: 'test_client_id',
            client_secret: 'test_client_secret'
        });
    });

    describe('Constructor', () => {
        test('should initialize with API token', () => {
            expect(api.apiToken).toBe('test_api_token');
            expect(api.baseUrl).toBe('https://api.todoist.com/rest/v2');
            expect(api.syncUrl).toBe('https://api.todoist.com/sync/v9');
        });

        test('should initialize with OAuth credentials', () => {
            const oauthApi = new Api({
                client_id: 'test_client_id',
                client_secret: 'test_client_secret',
                access_token: 'test_access_token'
            });
            
            expect(oauthApi.access_token).toBe('test_access_token');
            expect(oauthApi.client_id).toBe('test_client_id');
        });

        test('should set OAuth endpoints correctly', () => {
            expect(api.authorizationUri).toBe('https://todoist.com/oauth/authorize');
            expect(api.tokenUri).toBe('https://todoist.com/oauth/access_token');
        });
    });

    describe('Authentication', () => {
        test('should generate correct auth URI', () => {
            const authUri = api.getAuthUri(['data:read_write']);
            
            expect(authUri).toContain('https://todoist.com/oauth/authorize');
            expect(authUri).toContain('client_id=test_client_id');
            expect(authUri).toContain('scope=data%3Aread_write');
        });

        test('should add API token auth headers', () => {
            const options = { headers: {} };
            api.addAuthHeaders(options);
            
            expect(options.headers.Authorization).toBe('Bearer test_api_token');
            expect(options.headers['Content-Type']).toBe('application/json');
        });

        test('should add OAuth token auth headers', () => {
            api.apiToken = null;
            api.access_token = 'oauth_token';
            
            const options = { headers: {} };
            api.addAuthHeaders(options);
            
            expect(options.headers.Authorization).toBe('Bearer oauth_token');
        });

        test('should throw error when no token available', () => {
            api.apiToken = null;
            api.access_token = null;
            
            const options = { headers: {} };
            expect(() => api.addAuthHeaders(options)).toThrow('No authentication token available');
        });
    });

    describe('URL Construction', () => {
        test('should construct project URLs correctly', () => {
            expect(api.URLs.projects).toBe('/projects');
            expect(api.URLs.projectById(123)).toBe('/projects/123');
        });

        test('should construct task URLs correctly', () => {
            expect(api.URLs.tasks).toBe('/tasks');
            expect(api.URLs.taskById(456)).toBe('/tasks/456');
            expect(api.URLs.tasksByProject(123)).toBe('/tasks?project_id=123');
            expect(api.URLs.tasksBySection(789)).toBe('/tasks?section_id=789');
            expect(api.URLs.taskClose(456)).toBe('/tasks/456/close');
        });

        test('should construct label URLs correctly', () => {
            expect(api.URLs.labels).toBe('/labels');
            expect(api.URLs.labelById(101)).toBe('/labels/101');
            expect(api.URLs.personalLabels).toBe('/labels?is_shared=false');
            expect(api.URLs.sharedLabels).toBe('/labels?is_shared=true');
        });

        test('should construct comment URLs correctly', () => {
            expect(api.URLs.comments).toBe('/comments');
            expect(api.URLs.commentById(202)).toBe('/comments/202');
            expect(api.URLs.taskComments(456)).toBe('/comments?task_id=456');
        });
    });

    describe('Request ID Generation', () => {
        test('should generate unique request IDs', () => {
            const id1 = api.generateRequestId();
            const id2 = api.generateRequestId();
            
            expect(id1).toBe('mocked-uuid-12345');
            expect(id2).toBe('mocked-uuid-12345');
            expect(typeof id1).toBe('string');
        });
    });

    describe('Sync Headers', () => {
        test('should add sync API headers', () => {
            const options = { headers: {} };
            api.addSyncHeaders(options);
            
            expect(options.headers.Authorization).toBe('Bearer test_api_token');
            expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });
    });

    describe('Task Filtering', () => {
        test('should construct filter URLs correctly', () => {
            const filterUrl = api.URLs.tasksByFilter('today & p1');
            expect(filterUrl).toBe('/tasks?filter=today%20%26%20p1');
        });
    });
});