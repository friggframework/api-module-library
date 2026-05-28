const crypto = require('crypto');
const webhooksExtension = require('../../extensions/webhooks');
const {
    verifyHubSpotSignature,
    reconstructUrl,
    extractBodyString,
    safeCompare,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByPortalId,
} = require('../../extensions/webhooks/lookup');
const {
    onHubSpotWebhookReceived,
    onHubSpotWebhookResolve,
    onHubSpotWebhook,
} = require('../../extensions/webhooks/handlers');

const CLIENT_SECRET = 'test-client-secret';

const buildSignedRequest = ({
    method = 'POST',
    url = '/api/hubspot-integration/webhooks',
    host = 'app.example.com',
    proto = 'https',
    body = [{ portalId: 111, subscriptionType: 'contact.creation', objectId: 1 }],
    timestamp = Date.now(),
    clientSecret = CLIENT_SECRET,
    extraHeaders = {},
    overrideSignature,
    overrideTimestamp,
    rawBody,
} = {}) => {
    const bodyString = rawBody !== undefined
        ? rawBody
        : (typeof body === 'string' ? body : JSON.stringify(body));
    const fullUrl = `${proto}://${host}${url}`;
    const message = `${method}${fullUrl}${bodyString}${timestamp}`;
    const signature = crypto
        .createHmac('sha256', clientSecret)
        .update(message, 'utf8')
        .digest('base64');

    return {
        method,
        url,
        originalUrl: url,
        protocol: proto,
        body: typeof body === 'string' ? body : body,
        rawBody: rawBody,
        headers: {
            host,
            'x-hubspot-signature-v3': overrideSignature ?? signature,
            'x-hubspot-request-timestamp':
                overrideTimestamp ?? String(timestamp),
            ...extraHeaders,
        },
    };
};

const makeRes = () => {
    const res = {};
    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn((payload) => {
        res.body = payload;
        return res;
    });
    return res;
};

describe('hubspot-webhooks extension bundle shape', () => {
    it('conforms to the Tier 3 contract', () => {
        expect(webhooksExtension).toEqual(
            expect.objectContaining({
                name: 'hubspot-webhooks',
                routes: expect.any(Array),
                events: expect.any(Object),
            })
        );
        expect(webhooksExtension.routes).toHaveLength(1);
        expect(webhooksExtension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'HUBSPOT_WEBHOOK_RECEIVED',
        });
    });

    it('declares useDatabase: false so the receiver route is DB-free', () => {
        expect(webhooksExtension.useDatabase).toBe(false);
    });

    it('every route event references a declared event', () => {
        for (const route of webhooksExtension.routes) {
            expect(webhooksExtension.events).toHaveProperty(route.event);
        }
    });

    it('declares the receiver, resolve, and webhook events with function handlers', () => {
        expect(
            typeof webhooksExtension.events.HUBSPOT_WEBHOOK_RECEIVED.handler
        ).toBe('function');
        expect(
            typeof webhooksExtension.events.HUBSPOT_WEBHOOK_RESOLVE.handler
        ).toBe('function');
        expect(typeof webhooksExtension.events.HUBSPOT_WEBHOOK.handler).toBe(
            'function'
        );
    });
});

describe('verifyHubSpotSignature', () => {
    it('returns valid:true for a correctly-signed request', () => {
        const req = buildSignedRequest();
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(true);
    });

    it('returns valid:false on signature mismatch', () => {
        const req = buildSignedRequest({ overrideSignature: 'AAAA' });
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/);
    });

    it('returns valid:false when the signature header is missing', () => {
        const req = buildSignedRequest();
        delete req.headers['x-hubspot-signature-v3'];
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/x-hubspot-signature-v3/);
    });

    it('returns valid:false when the timestamp header is missing', () => {
        const req = buildSignedRequest();
        delete req.headers['x-hubspot-request-timestamp'];
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/timestamp/);
    });

    it('rejects timestamps older than the skew window', () => {
        const stale = Date.now() - 10 * 60 * 1000;
        const req = buildSignedRequest({ timestamp: stale });
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/timestamp skew/);
    });

    it('rejects timestamps too far in the future', () => {
        const future = Date.now() + 10 * 60 * 1000;
        const req = buildSignedRequest({ timestamp: future });
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/timestamp skew/);
    });

    it('rejects non-numeric timestamp headers', () => {
        const req = buildSignedRequest({ overrideTimestamp: 'not-a-number' });
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/malformed/);
    });

    it('returns valid:false when client secret is missing', () => {
        const req = buildSignedRequest();
        const result = verifyHubSpotSignature({ req, clientSecret: undefined });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/client secret/);
    });

    it('honours X-Forwarded-Proto/Host headers when present', () => {
        const timestamp = Date.now();
        const body = [{ portalId: 1 }];
        const bodyString = JSON.stringify(body);
        const fullUrl = `https://public.example.com/api/hubspot-integration/webhooks`;
        const signature = crypto
            .createHmac('sha256', CLIENT_SECRET)
            .update(`POST${fullUrl}${bodyString}${timestamp}`, 'utf8')
            .digest('base64');

        const req = {
            method: 'POST',
            url: '/api/hubspot-integration/webhooks',
            originalUrl: '/api/hubspot-integration/webhooks',
            protocol: 'http',
            body,
            headers: {
                host: 'internal-lb.local',
                'x-forwarded-proto': 'https',
                'x-forwarded-host': 'public.example.com',
                'x-hubspot-signature-v3': signature,
                'x-hubspot-request-timestamp': String(timestamp),
            },
        };
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(true);
    });

    it('uses HUBSPOT_WEBHOOK_BASE_URL override when set', () => {
        const previous = process.env.HUBSPOT_WEBHOOK_BASE_URL;
        process.env.HUBSPOT_WEBHOOK_BASE_URL = 'https://override.example.com';

        const timestamp = Date.now();
        const body = [{ portalId: 1 }];
        const bodyString = JSON.stringify(body);
        const fullUrl = `https://override.example.com/api/hubspot-integration/webhooks`;
        const signature = crypto
            .createHmac('sha256', CLIENT_SECRET)
            .update(`POST${fullUrl}${bodyString}${timestamp}`, 'utf8')
            .digest('base64');

        const req = {
            method: 'POST',
            originalUrl: '/api/hubspot-integration/webhooks',
            protocol: 'http',
            body,
            headers: {
                host: 'something-else.local',
                'x-hubspot-signature-v3': signature,
                'x-hubspot-request-timestamp': String(timestamp),
            },
        };
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(true);

        if (previous === undefined) {
            delete process.env.HUBSPOT_WEBHOOK_BASE_URL;
        } else {
            process.env.HUBSPOT_WEBHOOK_BASE_URL = previous;
        }
    });

    it('uses req.rawBody when present so JSON re-serialization cannot break the HMAC', () => {
        const timestamp = Date.now();
        const rawBody = '[{"portalId":1,"foo":  "bar" }]'; // intentional weird spacing
        const fullUrl = `https://app.example.com/api/hubspot-integration/webhooks`;
        const signature = crypto
            .createHmac('sha256', CLIENT_SECRET)
            .update(`POST${fullUrl}${rawBody}${timestamp}`, 'utf8')
            .digest('base64');

        const req = {
            method: 'POST',
            originalUrl: '/api/hubspot-integration/webhooks',
            protocol: 'https',
            rawBody,
            body: JSON.parse(rawBody),
            headers: {
                host: 'app.example.com',
                'x-hubspot-signature-v3': signature,
                'x-hubspot-request-timestamp': String(timestamp),
            },
        };
        const result = verifyHubSpotSignature({ req, clientSecret: CLIENT_SECRET });
        expect(result.valid).toBe(true);
    });
});

describe('signature-verifier helpers', () => {
    it('safeCompare returns false on length mismatch', () => {
        // 4 chars (3 bytes) vs 8 chars (6 bytes) — clearly different decoded lengths
        expect(safeCompare('AAAA', 'AAAAAAAA')).toBe(false);
    });

    it('safeCompare returns true on identical inputs', () => {
        expect(safeCompare('hello', 'hello')).toBe(true);
    });

    it('safeCompare returns false on non-string inputs', () => {
        expect(safeCompare(null, 'abc')).toBe(false);
        expect(safeCompare('abc', undefined)).toBe(false);
    });

    it('extractBodyString returns empty string for null body', () => {
        expect(extractBodyString({ body: null })).toBe('');
    });

    it('extractBodyString prefers rawBody string', () => {
        expect(extractBodyString({ rawBody: 'raw', body: { a: 1 } })).toBe('raw');
    });

    it('extractBodyString prefers rawBody buffer', () => {
        expect(
            extractBodyString({ rawBody: Buffer.from('hello'), body: {} })
        ).toBe('hello');
    });

    it('extractBodyString JSON-stringifies object bodies', () => {
        expect(extractBodyString({ body: { a: 1 } })).toBe('{"a":1}');
    });

    it('reconstructUrl falls back to req.protocol + host when no forwarded headers', () => {
        const req = {
            protocol: 'https',
            originalUrl: '/abc',
            headers: { host: 'foo.local' },
        };
        expect(reconstructUrl(req)).toBe('https://foo.local/abc');
    });
});

describe('findIntegrationByPortalId wrapper', () => {
    it('delegates to commands.findIntegrationByEntityExternalId with the module name from definition.js', async () => {
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('integration-abc'),
            },
        };
        const result = await findIntegrationByPortalId(integration, 42);
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith(42, 'hubspot');
        expect(result).toBe('integration-abc');
    });

    it('throws when the integration does not expose commands.findIntegrationByEntityExternalId', async () => {
        await expect(findIntegrationByPortalId({}, 42)).rejects.toThrow(
            /commands\.findIntegrationByEntityExternalId/
        );
        await expect(
            findIntegrationByPortalId({ commands: {} }, 42)
        ).rejects.toThrow(/commands\.findIntegrationByEntityExternalId/);
    });

    it('propagates ambiguous-resolution errors instead of swallowing them', async () => {
        const ambiguous = new Error(
            'ambiguous resolution — externalId=42 matched 2 entities'
        );
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockRejectedValue(ambiguous),
            },
        };
        await expect(
            findIntegrationByPortalId(integration, 42)
        ).rejects.toThrow(/ambiguous/);
    });
});

describe('onHubSpotWebhookReceived (DB-free receiver)', () => {
    let previousClientSecret;

    beforeAll(() => {
        previousClientSecret = process.env.HUBSPOT_CLIENT_SECRET;
        process.env.HUBSPOT_CLIENT_SECRET = CLIENT_SECRET;
    });

    afterAll(() => {
        if (previousClientSecret === undefined) {
            delete process.env.HUBSPOT_CLIENT_SECRET;
        } else {
            process.env.HUBSPOT_CLIENT_SECRET = previousClientSecret;
        }
    });

    // The receiver must NOT touch the database. We give it a commands spy so we
    // can assert it is never called, plus a queueWebhook spy.
    const makeIntegration = () => ({
        commands: {
            findIntegrationByEntityExternalId: jest.fn(),
        },
        queueWebhook: jest.fn().mockResolvedValue(undefined),
    });

    it('returns 401 on invalid signature and enqueues nothing', async () => {
        const integration = makeIntegration();
        const req = buildSignedRequest({ overrideSignature: 'AAAA' });
        const res = makeRes();
        await onHubSpotWebhookReceived.call(integration, { req, res });
        expect(res.statusCode).toBe(401);
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });

    it('returns 401 when the signature header is missing', async () => {
        const integration = makeIntegration();
        const req = buildSignedRequest();
        delete req.headers['x-hubspot-signature-v3'];
        const res = makeRes();
        await onHubSpotWebhookReceived.call(integration, { req, res });
        expect(res.statusCode).toBe(401);
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });

    it('returns 401 when HUBSPOT_CLIENT_SECRET is not set', async () => {
        const saved = process.env.HUBSPOT_CLIENT_SECRET;
        delete process.env.HUBSPOT_CLIENT_SECRET;
        try {
            const integration = makeIntegration();
            const req = buildSignedRequest();
            const res = makeRes();
            await onHubSpotWebhookReceived.call(integration, { req, res });
            expect(res.statusCode).toBe(401);
            expect(integration.queueWebhook).not.toHaveBeenCalled();
        } finally {
            process.env.HUBSPOT_CLIENT_SECRET = saved;
        }
    });

    it('enqueues one HUBSPOT_WEBHOOK_RESOLVE per event WITHOUT any DB lookup', async () => {
        const integration = makeIntegration();
        const body = [
            { portalId: 111, subscriptionType: 'contact.creation', objectId: 1 },
            { portalId: 222, subscriptionType: 'deal.creation', objectId: 2 },
        ];
        const req = buildSignedRequest({ body });
        const res = makeRes();

        await onHubSpotWebhookReceived.call(integration, { req, res });

        // The receiver is DB-free: it must never perform the portal lookup.
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).not.toHaveBeenCalled();

        expect(integration.queueWebhook).toHaveBeenCalledTimes(2);
        expect(integration.queueWebhook).toHaveBeenCalledWith({
            event: 'HUBSPOT_WEBHOOK_RESOLVE',
            body: body[0],
        });
        expect(integration.queueWebhook).toHaveBeenCalledWith({
            event: 'HUBSPOT_WEBHOOK_RESOLVE',
            body: body[1],
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ received: 2, queued: 2, skipped: 0 });
    });

    it('skips events missing a portalId (nothing to resolve later)', async () => {
        const integration = makeIntegration();
        const body = [
            { subscriptionType: 'contact.creation', objectId: 1 }, // no portalId
            { portalId: 222, subscriptionType: 'deal.creation', objectId: 2 },
        ];
        const req = buildSignedRequest({ body });
        const res = makeRes();

        await onHubSpotWebhookReceived.call(integration, { req, res });

        expect(integration.queueWebhook).toHaveBeenCalledTimes(1);
        expect(integration.queueWebhook).toHaveBeenCalledWith({
            event: 'HUBSPOT_WEBHOOK_RESOLVE',
            body: body[1],
        });
        expect(res.body).toEqual({ received: 2, queued: 1, skipped: 1 });
    });

    it('returns 200 with zero counts on an empty event array', async () => {
        const integration = makeIntegration();
        const req = buildSignedRequest({ body: [] });
        const res = makeRes();
        await onHubSpotWebhookReceived.call(integration, { req, res });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ received: 0, queued: 0, skipped: 0 });
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });
});

describe('onHubSpotWebhookResolve (queue worker, DB)', () => {
    const makeIntegration = (lookupImpl) => ({
        commands: {
            findIntegrationByEntityExternalId: jest.fn(
                lookupImpl ||
                    (async (portalId) =>
                        portalId === 999
                            ? null
                            : `integration-for-portal-${portalId}`)
            ),
        },
        queueWebhook: jest.fn().mockResolvedValue(undefined),
    });

    it('resolves portalId → integrationId and re-enqueues HUBSPOT_WEBHOOK bound to it', async () => {
        const integration = makeIntegration();
        const body = { portalId: 111, subscriptionType: 'contact.creation' };

        await onHubSpotWebhookResolve.call(integration, { data: { body } });

        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith(111, 'hubspot');
        expect(integration.queueWebhook).toHaveBeenCalledTimes(1);
        expect(integration.queueWebhook).toHaveBeenCalledWith({
            event: 'HUBSPOT_WEBHOOK',
            integrationId: 'integration-for-portal-111',
            body,
        });
    });

    it('skips (does not re-enqueue) when no integration owns the portal', async () => {
        const integration = makeIntegration();
        await onHubSpotWebhookResolve.call(integration, {
            data: { body: { portalId: 999 } },
        });
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });

    it('skips when the queued body has no portalId', async () => {
        const integration = makeIntegration();
        await onHubSpotWebhookResolve.call(integration, {
            data: { body: { subscriptionType: 'contact.creation' } },
        });
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).not.toHaveBeenCalled();
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });

    it('propagates ambiguous-resolution errors instead of swallowing them', async () => {
        const integration = makeIntegration(async () => {
            throw new Error('ambiguous resolution');
        });
        await expect(
            onHubSpotWebhookResolve.call(integration, {
                data: { body: { portalId: 111 } },
            })
        ).rejects.toThrow(/ambiguous/);
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });

    it('throws a clear error when the integration has no commands wired (createFriggCommands missing)', async () => {
        const integration = { queueWebhook: jest.fn() }; // no `commands`
        await expect(
            onHubSpotWebhookResolve.call(integration, {
                data: { body: { portalId: 111 } },
            })
        ).rejects.toThrow(/commands\.findIntegrationByEntityExternalId/);
        expect(integration.queueWebhook).not.toHaveBeenCalled();
    });
});

describe('onHubSpotWebhook (default per-event handler)', () => {
    it('is a no-op that does not throw', async () => {
        await expect(
            onHubSpotWebhook.call({}, { data: { body: { portalId: 1 } } })
        ).resolves.toBeUndefined();
    });
});
