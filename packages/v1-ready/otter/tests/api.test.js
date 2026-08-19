const { Api } = require('../api');

function makeApi(params = { api_token: 'test-key-123' }) {
    const api = new Api(params);
    // Capture requests instead of hitting the network.
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Otter Api', () => {
    describe('auth', () => {
        it('uses the Authorization header with a Bearer-prefixed value', () => {
            const api = new Api({ api_token: 'abc' });
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('Bearer abc');
            expect(api.api_token).toBe('abc');
        });

        it('accepts the token under api_key or access_token too', () => {
            expect(new Api({ api_key: 'abc' }).api_token).toBe('abc');
            expect(new Api({ access_token: 'abc' }).api_token).toBe('abc');
        });

        it('strips a pre-existing Bearer prefix so it is never doubled', () => {
            const api = new Api({ api_token: 'Bearer abc' });
            expect(api.api_token).toBe('abc');
            expect(api.api_key).toBe('Bearer abc');
        });

        it('injects the Bearer token into request headers via addAuthHeaders', async () => {
            const api = new Api({ api_token: 'abc' });
            const headers = await api.addAuthHeaders({});
            expect(headers['Authorization']).toBe('Bearer abc');
        });

        it('points at the Otter public API base URL', () => {
            const api = new Api({ api_token: 'abc' });
            expect(api.baseUrl).toBe('https://api.otter.ai/v1');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_token: 'abc' }).isAuthenticated()).toBe(true);
            expect(new Api({ api_token: '' }).isAuthenticated()).toBe(false);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('endpoints', () => {
        it('getWorkspace gets /workspace', async () => {
            const api = makeApi();
            await api.getWorkspace();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe('https://api.otter.ai/v1/workspace');
        });

        it('listChannels gets /channels', async () => {
            const api = makeApi();
            await api.listChannels();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe('https://api.otter.ai/v1/channels');
        });

        it('listConversations gets /conversations and forwards pagination query', async () => {
            const api = makeApi();
            await api.listConversations({ page_size: 25, cursor: 'abc' });
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                'https://api.otter.ai/v1/conversations'
            );
            expect(api.sent[0].query).toEqual({ page_size: 25, cursor: 'abc' });
        });

        it('getConversation gets /conversations/{id}', async () => {
            const api = makeApi();
            await api.getConversation('conv-1');
            expect(api.sent[0].url).toBe(
                'https://api.otter.ai/v1/conversations/conv-1'
            );
            expect(api.sent[0].query).toEqual({});
        });

        it('getConversation joins an include array into a comma string', async () => {
            const api = makeApi();
            await api.getConversation('conv-1', {
                include: ['transcript', 'action_items'],
            });
            expect(api.sent[0].query).toEqual({
                include: 'transcript,action_items',
            });
        });

        it('getConversation passes an include string through unchanged', async () => {
            const api = makeApi();
            await api.getConversation('conv-1', { include: 'all' });
            expect(api.sent[0].query).toEqual({ include: 'all' });
        });

        it('getConversationTranscript delegates to getConversation with include=transcript', async () => {
            const api = makeApi();
            await api.getConversationTranscript('conv-1');
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                'https://api.otter.ai/v1/conversations/conv-1'
            );
            expect(api.sent[0].query).toEqual({ include: 'transcript' });
        });

        it('testAuth performs a lightweight workspace fetch', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe('https://api.otter.ai/v1/workspace');
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('declares an apiKey requirement for api_token', () => {
            const api = new Api({ api_token: 'abc' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toContain('api_token');
            expect(reqs.data.uiSchema.api_token['ui:widget']).toBe('password');
        });
    });
});
