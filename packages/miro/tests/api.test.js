const { Api } = require('../api');

describe('Miro API', () => {
    let api;
    
    beforeEach(() => {
        api = new Api({
            client_id: 'test_client_id',
            client_secret: 'test_client_secret',
            access_token: 'test_access_token',
            redirect_uri: 'https://example.com/callback'
        });
    });

    describe('Constructor', () => {
        test('should initialize with correct credentials', () => {
            expect(api.client_id).toBe('test_client_id');
            expect(api.client_secret).toBe('test_client_secret');
            expect(api.access_token).toBe('test_access_token');
            expect(api.baseUrl).toBe('https://api.miro.com/v2');
        });

        test('should set OAuth endpoints correctly', () => {
            expect(api.authorizationUri).toBe('https://miro.com/oauth/authorize');
            expect(api.tokenUri).toBe('https://api.miro.com/v1/oauth/token');
        });

        test('should set default scope', () => {
            expect(api.scope).toBe('boards:read boards:write');
        });
    });

    describe('Authentication', () => {
        test('should generate correct auth URI', () => {
            const authUri = api.getAuthUri();
            
            expect(authUri).toContain('https://miro.com/oauth/authorize');
            expect(authUri).toContain('client_id=test_client_id');
            expect(authUri).toContain('response_type=code');
            // URL encoding can use either %20 or + for spaces
            expect(authUri).toMatch(/scope=boards%3Aread[\+%20]boards%3Awrite/);
        });

        test('should generate auth URI with custom scopes', () => {
            const authUri = api.getAuthUri('boards:read teams:read');
            
            // URL encoding can use either %20 or + for spaces
            expect(authUri).toMatch(/scope=boards%3Aread[\+%20]teams%3Aread/);
        });

        test('should add correct auth headers', () => {
            const options = { headers: {} };
            api.addAuthHeaders(options);
            
            expect(options.headers.Authorization).toBe('Bearer test_access_token');
            expect(options.headers['Content-Type']).toBe('application/json');
            expect(options.headers.Accept).toBe('application/json');
        });
    });

    describe('URL Construction', () => {
        test('should construct board URLs correctly', () => {
            expect(api.URLs.boards).toBe('/boards');
            expect(api.URLs.boardById('123')).toBe('/boards/123');
        });

        test('should construct board items URLs correctly', () => {
            expect(api.URLs.boardItems('123')).toBe('/boards/123/items');
            expect(api.URLs.boardItemById('123', '456')).toBe('/boards/123/items/456');
        });

        test('should construct sticky notes URLs correctly', () => {
            expect(api.URLs.stickyNotes('123')).toBe('/boards/123/sticky_notes');
            expect(api.URLs.stickyNoteById('123', '456')).toBe('/boards/123/sticky_notes/456');
        });

        test('should construct shapes URLs correctly', () => {
            expect(api.URLs.shapes('123')).toBe('/boards/123/shapes');
            expect(api.URLs.shapeById('123', '456')).toBe('/boards/123/shapes/456');
        });

        test('should construct texts URLs correctly', () => {
            expect(api.URLs.texts('123')).toBe('/boards/123/texts');
            expect(api.URLs.textById('123', '456')).toBe('/boards/123/texts/456');
        });

        test('should construct images URLs correctly', () => {
            expect(api.URLs.images('123')).toBe('/boards/123/images');
            expect(api.URLs.imageById('123', '456')).toBe('/boards/123/images/456');
        });

        test('should construct frames URLs correctly', () => {
            expect(api.URLs.frames('123')).toBe('/boards/123/frames');
            expect(api.URLs.frameById('123', '456')).toBe('/boards/123/frames/456');
        });

        test('should construct connectors URLs correctly', () => {
            expect(api.URLs.connectors('123')).toBe('/boards/123/connectors');
            expect(api.URLs.connectorById('123', '456')).toBe('/boards/123/connectors/456');
        });

        test('should construct tags URLs correctly', () => {
            expect(api.URLs.tags('123')).toBe('/boards/123/tags');
            expect(api.URLs.tagById('123', '456')).toBe('/boards/123/tags/456');
        });

        test('should construct teams URLs correctly', () => {
            expect(api.URLs.teams).toBe('/teams');
            expect(api.URLs.teamById('123')).toBe('/teams/123');
            expect(api.URLs.teamMembers('123')).toBe('/teams/123/members');
            expect(api.URLs.teamMemberById('123', '456')).toBe('/teams/123/members/456');
        });

        test('should construct comments URLs correctly', () => {
            expect(api.URLs.boardComments('123')).toBe('/boards/123/comments');
            expect(api.URLs.itemComments('123', '456')).toBe('/boards/123/items/456/comments');
            expect(api.URLs.commentById('123', '456')).toBe('/boards/123/comments/456');
        });

        test('should construct webhooks URLs correctly', () => {
            expect(api.URLs.webhooks).toBe('/webhooks');
            expect(api.URLs.webhookById('123')).toBe('/webhooks/123');
        });

        test('should construct templates URLs correctly', () => {
            expect(api.URLs.templates).toBe('/templates');
            expect(api.URLs.templateById('123')).toBe('/templates/123');
        });

        test('should construct user info URL correctly', () => {
            expect(api.URLs.userInfo).toBe('/users/me');
        });
    });

    describe('Scope Handling', () => {
        test('should use custom scope if provided in constructor', () => {
            const customApi = new Api({
                scope: 'boards:read teams:read',
                client_id: 'test',
                client_secret: 'test'
            });
            
            expect(customApi.scope).toBe('boards:read teams:read');
        });
    });
});