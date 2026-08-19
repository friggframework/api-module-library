const { Api } = require('../api');

/**
 * Offline tests. We inject a fake `fetch` (supported by the Requester base via
 * the `fetch` constructor param) and assert on the exact request the module
 * builds: the GraphQL endpoint, the `Authorization: Bearer <key>` header, and
 * the JSON `{ query, variables }` body.
 */
function makeApi(captured, responseData) {
    const fakeFetch = async (url, options) => {
        captured.url = url;
        captured.options = options;
        return {
            status: 200,
            headers: {
                get: (name) =>
                    name.toLowerCase() === 'content-type'
                        ? 'application/json'
                        : null,
            },
            json: async () => ({ data: responseData }),
            text: async () => JSON.stringify({ data: responseData }),
        };
    };
    return new Api({ api_key: 'ff_test_key_123', fetch: fakeFetch });
}

describe('Fireflies Api', () => {
    describe('auth header', () => {
        it('sends Authorization: Bearer <key> to the GraphQL endpoint', async () => {
            const captured = {};
            const api = makeApi(captured, { user: { user_id: 'u1' } });

            await api.getUser();

            expect(captured.url).toBe('https://api.fireflies.ai/graphql');
            expect(captured.options.method).toBe('POST');
            expect(captured.options.headers.Authorization).toBe(
                'Bearer ff_test_key_123'
            );
            expect(captured.options.headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('does not persist the "Bearer " prefix on the stored key', () => {
            const api = makeApi({}, {});
            expect(api.api_key).toBe('ff_test_key_123');
        });
    });

    describe('listTranscripts()', () => {
        it('POSTs a GraphQL body with the transcripts query and variables', async () => {
            const captured = {};
            const api = makeApi(captured, {
                transcripts: [{ id: 't1', title: 'Call' }],
            });

            const result = await api.listTranscripts({
                limit: 5,
                skip: 0,
                fromDate: '2026-01-01T00:00:00.000Z',
            });

            const body = JSON.parse(captured.options.body);
            expect(body.query).toContain('transcripts(');
            expect(body.query).toContain('meeting_attendees');
            expect(body.query).toContain('email');
            expect(body.variables).toEqual({
                limit: 5,
                skip: 0,
                fromDate: '2026-01-01T00:00:00.000Z',
            });
            expect(result).toEqual([{ id: 't1', title: 'Call' }]);
        });

        it('omits variables that were not supplied', async () => {
            const captured = {};
            const api = makeApi(captured, { transcripts: [] });

            await api.listTranscripts({ limit: 10 });

            const body = JSON.parse(captured.options.body);
            expect(body.variables).toEqual({ limit: 10 });
        });

        it('uses the array organizers/participants args (not the deprecated scalar *_email args) and wraps a single email', async () => {
            const captured = {};
            const api = makeApi(captured, { transcripts: [] });

            await api.listTranscripts({
                organizerEmail: 'host@example.com',
                participantEmail: 'guest@example.com',
            });

            const body = JSON.parse(captured.options.body);
            // deprecated scalar args must be gone from the query text
            expect(body.query).not.toContain('organizer_email:');
            expect(body.query).not.toContain('participant_email:');
            expect(body.query).toContain('organizers: $organizers');
            expect(body.query).toContain('participants: $participants');
            expect(body.query).toContain('$organizers: [String]');
            expect(body.query).toContain('$participants: [String]');
            // a single email is wrapped in an array on the wire
            expect(body.variables).toEqual({
                organizers: ['host@example.com'],
                participants: ['guest@example.com'],
            });
        });

        it('passes an array of emails through unchanged', async () => {
            const captured = {};
            const api = makeApi(captured, { transcripts: [] });

            await api.listTranscripts({
                organizerEmail: ['a@example.com', 'b@example.com'],
            });

            const body = JSON.parse(captured.options.body);
            expect(body.variables).toEqual({
                organizers: ['a@example.com', 'b@example.com'],
            });
        });
    });

    describe('getTranscript()', () => {
        it('POSTs the single-transcript query with an id variable and requests summary + sentences', async () => {
            const captured = {};
            const api = makeApi(captured, {
                transcript: { id: 't42', title: 'Deep Dive' },
            });

            const result = await api.getTranscript('t42');

            const body = JSON.parse(captured.options.body);
            expect(body.query).toContain('transcript(id: $id)');
            expect(body.query).toContain('summary {');
            expect(body.query).toContain('sentences {');
            expect(body.query).toContain('meeting_attendees {');
            expect(body.variables).toEqual({ id: 't42' });
            expect(result).toEqual({ id: 't42', title: 'Deep Dive' });
        });
    });

    describe('getTranscriptSummary()', () => {
        it('requests only the summary block', async () => {
            const captured = {};
            const api = makeApi(captured, {
                transcript: { id: 't7', summary: { overview: 'x' } },
            });

            await api.getTranscriptSummary('t7');

            const body = JSON.parse(captured.options.body);
            expect(body.query).toContain('summary {');
            expect(body.query).not.toContain('sentences {');
            expect(body.variables).toEqual({ id: 't7' });
        });
    });

    describe('searchTranscripts()', () => {
        it('passes the keyword through as a transcripts variable', async () => {
            const captured = {};
            const api = makeApi(captured, { transcripts: [] });

            await api.searchTranscripts('pricing', { limit: 3 });

            const body = JSON.parse(captured.options.body);
            expect(body.variables).toEqual({ limit: 3, keyword: 'pricing' });
        });
    });

    describe('graphql() error handling', () => {
        it('throws when the response carries a GraphQL errors array', async () => {
            const fakeFetch = async () => ({
                status: 200,
                headers: {
                    get: () => 'application/json',
                },
                json: async () => ({
                    errors: [{ message: 'Not authorized' }],
                }),
                text: async () =>
                    JSON.stringify({ errors: [{ message: 'Not authorized' }] }),
            });
            const api = new Api({ api_key: 'k', fetch: fakeFetch });

            await expect(api.getUser()).rejects.toThrow(/Not authorized/);
        });
    });

    describe('getAuthorizationRequirements()', () => {
        it('returns an apiKey JSON Schema form with a password api_key field', () => {
            const api = new Api({ api_key: 'k' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toContain('api_key');
            expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
        });
    });
});
