const { Api } = require('../api');

describe('Quo Api (offline)', () => {
    describe('construction / auth', () => {
        it('sets the Authorization header name and raw key (no Bearer prefix)', async () => {
            const api = new Api({ api_key: 'op_test_123' });
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('op_test_123');
            expect(api.isAuthenticated()).toBe(true);

            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('op_test_123');
            expect(headers.Authorization).not.toMatch(/^Bearer /);
        });

        it('accepts access_token as an alias for api_key (credential rehydration)', () => {
            const api = new Api({ access_token: 'op_from_credential' });
            expect(api.api_key).toBe('op_from_credential');
            expect(api.isAuthenticated()).toBe(true);
        });

        it('is unauthenticated with no key', () => {
            const api = new Api({});
            expect(api.isAuthenticated()).toBe(false);
        });

        it('defaults the base URL to the production Quo/OpenPhone host', () => {
            const api = new Api({ api_key: 'x' });
            expect(api.baseUrl).toBe('https://api.openphone.com/v1');
        });

        it('honors a baseUrl override', () => {
            const api = new Api({ api_key: 'x', baseUrl: 'https://example.test/v1' });
            expect(api.baseUrl).toBe('https://example.test/v1');
        });
    });

    describe('URL builders', () => {
        const api = new Api({ api_key: 'x' });

        it('builds call endpoints', () => {
            expect(api.URLs.calls).toBe('/calls');
            expect(api.URLs.callById('AC1')).toBe('/calls/AC1');
            expect(api.URLs.callRecordings('AC1')).toBe('/call-recordings/AC1');
            expect(api.URLs.callTranscript('AC1')).toBe('/call-transcripts/AC1');
            expect(api.URLs.callSummary('AC1')).toBe('/call-summaries/AC1');
        });

        it('builds message and contact endpoints', () => {
            expect(api.URLs.messages).toBe('/messages');
            expect(api.URLs.messageById('AC9')).toBe('/messages/AC9');
            expect(api.URLs.contacts).toBe('/contacts');
        });

        it('exposes the read methods used by the Reevo integration', () => {
            for (const m of ['listCalls', 'getCall', 'getCallRecordings',
                'getCallTranscript', 'getCallSummary', 'listMessages',
                'listPhoneNumbers']) {
                expect(typeof api[m]).toBe('function');
            }
        });
    });

    describe('request wiring (mocked transport)', () => {
        it('listCalls issues a GET to /calls with the query', async () => {
            const api = new Api({ api_key: 'x' });
            const spy = jest
                .spyOn(api, '_get')
                .mockResolvedValue({ data: [] });

            await api.listCalls({ phoneNumberId: 'PN1', maxResults: 50 });

            expect(spy).toHaveBeenCalledWith({
                url: 'https://api.openphone.com/v1/calls',
                query: { phoneNumberId: 'PN1', maxResults: 50 },
            });
        });

        it('getCallTranscript issues a GET to /call-transcripts/{id}', async () => {
            const api = new Api({ api_key: 'x' });
            const spy = jest.spyOn(api, '_get').mockResolvedValue({ dialogue: [] });

            await api.getCallTranscript('AC42');

            expect(spy).toHaveBeenCalledWith({
                url: 'https://api.openphone.com/v1/call-transcripts/AC42',
            });
        });
    });

    // Full request-wiring coverage: every endpoint method asserts the ACTUAL
    // transport verb (_get / _post / _delete), URL, and (for writes) the body,
    // so a wrong path/verb/body would fail — not just a missing method.
    describe('request wiring — every endpoint (mocked transport)', () => {
        const BASE = 'https://api.openphone.com/v1';
        const JSON_HEADERS = { 'Content-Type': 'application/json' };

        let api;
        let getSpy;
        let postSpy;
        let deleteSpy;

        beforeEach(() => {
            api = new Api({ api_key: 'x' });
            getSpy = jest.spyOn(api, '_get').mockResolvedValue({ data: [] });
            postSpy = jest.spyOn(api, '_post').mockResolvedValue({ id: 'new' });
            deleteSpy = jest.spyOn(api, '_delete').mockResolvedValue({});
        });

        // ---- GET endpoints: [method, args, expected {url, query?}] ----
        const GET_CASES = [
            ['getCall', ['AC1'], { url: `${BASE}/calls/AC1` }],
            ['getCallRecordings', ['AC1'], { url: `${BASE}/call-recordings/AC1` }],
            ['getCallSummary', ['AC1'], { url: `${BASE}/call-summaries/AC1` }],
            [
                'listMessages',
                [{ phoneNumberId: 'PN1', maxResults: 25 }],
                { url: `${BASE}/messages`, query: { phoneNumberId: 'PN1', maxResults: 25 } },
            ],
            ['getMessage', ['AC9'], { url: `${BASE}/messages/AC9` }],
            [
                'listContacts',
                [{ maxResults: 10 }],
                { url: `${BASE}/contacts`, query: { maxResults: 10 } },
            ],
            ['getContact', ['CT7'], { url: `${BASE}/contacts/CT7` }],
            [
                'listPhoneNumbers',
                [{ userId: 'US1' }],
                { url: `${BASE}/phone-numbers`, query: { userId: 'US1' } },
            ],
            ['getPhoneNumber', ['PN5'], { url: `${BASE}/phone-numbers/PN5` }],
            [
                'listUsers',
                [{ maxResults: 5 }],
                { url: `${BASE}/users`, query: { maxResults: 5 } },
            ],
            ['getUser', ['US3'], { url: `${BASE}/users/US3` }],
            [
                'listWebhooks',
                [{ userId: 'US2' }],
                { url: `${BASE}/webhooks`, query: { userId: 'US2' } },
            ],
            ['getWebhook', ['WH1'], { url: `${BASE}/webhooks/WH1` }],
        ];

        it.each(GET_CASES)(
            '%s issues a GET to the correct URL (and query)',
            async (method, args, expected) => {
                await api[method](...args);
                expect(getSpy).toHaveBeenCalledTimes(1);
                expect(getSpy).toHaveBeenCalledWith(expected);
                expect(postSpy).not.toHaveBeenCalled();
                expect(deleteSpy).not.toHaveBeenCalled();
            }
        );

        // ---- POST endpoints: [method, bodyArg, expectedUrl] ----
        const POST_CASES = [
            ['sendMessage', { content: 'hi', to: ['+15555550100'] }, `${BASE}/messages`],
            ['createContact', { firstName: 'Ada' }, `${BASE}/contacts`],
            ['createCallWebhook', { url: 'https://cb/1' }, `${BASE}/webhooks/calls`],
            ['createMessageWebhook', { url: 'https://cb/2' }, `${BASE}/webhooks/messages`],
            [
                'createCallSummaryWebhook',
                { url: 'https://cb/3' },
                `${BASE}/webhooks/call-summaries`,
            ],
            [
                'createCallTranscriptWebhook',
                { url: 'https://cb/4' },
                `${BASE}/webhooks/call-transcripts`,
            ],
        ];

        it.each(POST_CASES)(
            '%s issues a POST to the correct URL with the JSON body',
            async (method, body, url) => {
                await api[method](body);
                expect(postSpy).toHaveBeenCalledTimes(1);
                expect(postSpy).toHaveBeenCalledWith({
                    url,
                    headers: JSON_HEADERS,
                    body,
                });
                expect(getSpy).not.toHaveBeenCalled();
                expect(deleteSpy).not.toHaveBeenCalled();
            }
        );

        it('deleteWebhook issues a DELETE to /webhooks/{id}', async () => {
            await api.deleteWebhook('WH9');
            expect(deleteSpy).toHaveBeenCalledTimes(1);
            expect(deleteSpy).toHaveBeenCalledWith({ url: `${BASE}/webhooks/WH9` });
            expect(getSpy).not.toHaveBeenCalled();
            expect(postSpy).not.toHaveBeenCalled();
        });
    });
});
