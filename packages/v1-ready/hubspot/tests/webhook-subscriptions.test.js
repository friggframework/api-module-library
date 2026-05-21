const { Api } = require('../api');

function makeResponse({ ok = true, status, body = {} } = {}) {
    return {
        ok,
        status: status ?? (ok ? 200 : 500),
        text: async () =>
            typeof body === 'string' ? body : JSON.stringify(body),
        json: async () =>
            typeof body === 'string' ? JSON.parse(body) : body,
    };
}

const APP_ID = 'app-42';
const DEVELOPER_API_KEY = 'dev-key-xyz';
const BASE = 'https://api.hubapi.com';

describe('HubSpot Webhook Subscriptions', () => {
    let originalFetch;
    let fetchMock;

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchMock = jest.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const api = new Api({
        client_id: 'unused-for-developer-endpoints',
        client_secret: 'unused-for-developer-endpoints',
    });

    test('listWebhookSubscriptions GETs /webhooks/v3/{appId}/subscriptions with Bearer auth', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({ ok: true, body: { results: [] } })
        );

        await api.listWebhookSubscriptions({
            appId: APP_ID,
            developerApiKey: DEVELOPER_API_KEY,
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/webhooks/v3/${APP_ID}/subscriptions`);
        expect(opts.method).toBe('GET');
        expect(opts.headers.Authorization).toBe(`Bearer ${DEVELOPER_API_KEY}`);
        expect(url).not.toContain('hapikey');
    });

    test('listWebhookSubscriptions returns the parsed results array', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({
                ok: true,
                body: { results: [{ id: 1 }, { id: 2 }] },
            })
        );

        const result = await api.listWebhookSubscriptions({
            appId: APP_ID,
            developerApiKey: DEVELOPER_API_KEY,
        });

        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('listWebhookSubscriptions throws on non-2xx', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({ ok: false, status: 403, body: 'forbidden' })
        );

        await expect(
            api.listWebhookSubscriptions({
                appId: APP_ID,
                developerApiKey: DEVELOPER_API_KEY,
            })
        ).rejects.toThrow(/403/);
    });

    test('createWebhookSubscription POSTs the spec body with Bearer auth', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({
                ok: true,
                status: 201,
                body: {
                    id: 7,
                    eventType: 'contact.creation',
                    active: true,
                },
            })
        );

        const result = await api.createWebhookSubscription({
            appId: APP_ID,
            developerApiKey: DEVELOPER_API_KEY,
            eventType: 'contact.creation',
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/webhooks/v3/${APP_ID}/subscriptions`);
        expect(opts.method).toBe('POST');
        expect(opts.headers.Authorization).toBe(`Bearer ${DEVELOPER_API_KEY}`);
        expect(opts.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(opts.body)).toEqual({
            eventType: 'contact.creation',
            active: true,
        });
        expect(result.status).toBe(201);
        expect(result.data.id).toBe(7);
    });

    test('createWebhookSubscription includes propertyName when provided', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({ ok: true, status: 201, body: { id: 8 } })
        );

        await api.createWebhookSubscription({
            appId: APP_ID,
            developerApiKey: DEVELOPER_API_KEY,
            eventType: 'contact.propertyChange',
            propertyName: 'email',
        });

        const [, opts] = fetchMock.mock.calls[0];
        expect(JSON.parse(opts.body)).toEqual({
            eventType: 'contact.propertyChange',
            propertyName: 'email',
            active: true,
        });
    });

    test('createWebhookSubscription returns the 409 conflict response without throwing', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({
                ok: false,
                status: 409,
                body: { message: 'already exists' },
            })
        );

        const result = await api.createWebhookSubscription({
            appId: APP_ID,
            developerApiKey: DEVELOPER_API_KEY,
            eventType: 'contact.creation',
        });

        expect(result.status).toBe(409);
        expect(result.data.message).toBe('already exists');
    });

    test('createWebhookSubscription throws on other non-2xx responses', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({ ok: false, status: 400, body: 'validation failed' })
        );

        await expect(
            api.createWebhookSubscription({
                appId: APP_ID,
                developerApiKey: DEVELOPER_API_KEY,
                eventType: 'contact.creation',
            })
        ).rejects.toThrow(/400/);
    });

    test('deleteWebhookSubscription DELETEs the sub-specific URL with Bearer auth', async () => {
        fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 204 }));

        await api.deleteWebhookSubscription({
            appId: APP_ID,
            developerApiKey: DEVELOPER_API_KEY,
            subscriptionId: '99',
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${BASE}/webhooks/v3/${APP_ID}/subscriptions/99`);
        expect(opts.method).toBe('DELETE');
        expect(opts.headers.Authorization).toBe(`Bearer ${DEVELOPER_API_KEY}`);
    });

    test('deleteWebhookSubscription tolerates 404 (idempotent)', async () => {
        fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 404 }));

        await expect(
            api.deleteWebhookSubscription({
                appId: APP_ID,
                developerApiKey: DEVELOPER_API_KEY,
                subscriptionId: '99',
            })
        ).resolves.toBeUndefined();
    });

    test('deleteWebhookSubscription throws on other non-2xx errors', async () => {
        fetchMock.mockResolvedValue(
            makeResponse({ ok: false, status: 500, body: 'boom' })
        );

        await expect(
            api.deleteWebhookSubscription({
                appId: APP_ID,
                developerApiKey: DEVELOPER_API_KEY,
                subscriptionId: '99',
            })
        ).rejects.toThrow(/500/);
    });
});
