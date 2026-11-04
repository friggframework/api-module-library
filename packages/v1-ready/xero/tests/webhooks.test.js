const crypto = require('crypto');
const {
    verifyXeroWebhookSignature,
    SIGNATURE_HEADER,
} = require('../extensions/webhooks/signature-verifier');
const {
    onXeroWebhookReceived,
    onXeroWebhookResolve,
} = require('../extensions/webhooks/handlers');
const { resolveIntegrationForTenant } = require('../extensions/webhooks/lookup');

function sign(body, key) {
    return crypto.createHmac('sha256', key).update(body, 'utf8').digest('base64');
}

describe('Xero webhook signature verifier', () => {
    const key = 'webhook-signing-key';
    const raw = '{"events":[],"lastEventSequence":0,"entropy":"abc"}';

    it('accepts a valid x-xero-signature over the raw body', () => {
        const req = {
            headers: { [SIGNATURE_HEADER]: sign(raw, key) },
            rawBody: raw,
        };
        expect(verifyXeroWebhookSignature(req, key)).toBe(true);
    });

    it('rejects a bad signature', () => {
        const req = {
            headers: { [SIGNATURE_HEADER]: 'nope' },
            rawBody: raw,
        };
        expect(verifyXeroWebhookSignature(req, key)).toBe(false);
    });

    it('rejects when the key is missing', () => {
        const req = {
            headers: { [SIGNATURE_HEADER]: sign(raw, key) },
            rawBody: raw,
        };
        expect(verifyXeroWebhookSignature(req, null)).toBe(false);
    });
});

describe('Xero webhook handlers', () => {
    const key = 'webhook-signing-key';
    const prev = process.env.XERO_WEBHOOK_KEY;

    beforeAll(() => {
        process.env.XERO_WEBHOOK_KEY = key;
    });
    afterAll(() => {
        if (prev === undefined) delete process.env.XERO_WEBHOOK_KEY;
        else process.env.XERO_WEBHOOK_KEY = prev;
    });

    it('returns 401 on bad signature', async () => {
        const statuses = [];
        const req = {
            headers: { [SIGNATURE_HEADER]: 'bad' },
            rawBody: '{}',
            body: {},
        };
        const res = {
            headersSent: false,
            status(code) {
                statuses.push(code);
                return this;
            },
            send() {
                return this;
            },
        };
        const result = await onXeroWebhookReceived({ req, res });
        expect(result.status).toBe(401);
        expect(statuses).toContain(401);
    });

    it('intent-to-receive (empty events) returns 200 after verify', async () => {
        const body = { events: [], lastEventSequence: 0, entropy: 'x' };
        const raw = JSON.stringify(body);
        const req = {
            headers: { [SIGNATURE_HEADER]: sign(raw, key) },
            rawBody: raw,
            body,
        };
        const res = {
            headersSent: false,
            status() {
                return this;
            },
            send() {
                return this;
            },
        };
        const result = await onXeroWebhookReceived({ req, res });
        expect(result.status).toBe(200);
        expect(result.intentToReceive).toBe(true);
    });

    it('enqueues resolve when events are present', async () => {
        const body = {
            events: [
                {
                    tenantId: 'ten-1',
                    eventCategory: 'CONTACT',
                    eventType: 'UPDATE',
                    resourceId: 'c-1',
                },
            ],
            lastEventSequence: 3,
        };
        const raw = JSON.stringify(body);
        const req = {
            headers: { [SIGNATURE_HEADER]: sign(raw, key) },
            rawBody: raw,
            body,
        };
        const res = {
            headersSent: false,
            status() {
                return this;
            },
            send() {
                return this;
            },
        };
        const result = await onXeroWebhookReceived({ req, res });
        expect(result.enqueue.event).toBe('XERO_WEBHOOK_RESOLVE');
        expect(result.enqueue.data.events).toHaveLength(1);
    });

    it('resolve fans out per tenantId', async () => {
        const result = await onXeroWebhookResolve({
            data: {
                events: [
                    { tenantId: 'a', resourceId: '1' },
                    { tenantId: 'a', resourceId: '2' },
                    { tenantId: 'b', resourceId: '3' },
                ],
            },
        });
        expect(result.enqueue).toHaveLength(2);
        expect(result.enqueue[0].event).toBe('XERO_WEBHOOK');
    });
});

describe('Xero webhook lookup', () => {
    it('returns the single match', async () => {
        const mapping = await resolveIntegrationForTenant(
            {
                findIntegrationsByExternalEntityId: async () => [{ id: 'int-1' }],
            },
            'ten-1'
        );
        expect(mapping.id).toBe('int-1');
    });

    it('throws on zero or ambiguous matches', async () => {
        await expect(
            resolveIntegrationForTenant(
                { findIntegrationsByExternalEntityId: async () => [] },
                'ten-1'
            )
        ).rejects.toThrow(/no integration mapping/i);
        await expect(
            resolveIntegrationForTenant(
                {
                    findIntegrationsByExternalEntityId: async () => [
                        { id: '1' },
                        { id: '2' },
                    ],
                },
                'ten-1'
            )
        ).rejects.toThrow(/ambiguous/i);
    });
});
