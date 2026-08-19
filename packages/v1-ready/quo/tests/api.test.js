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
});
