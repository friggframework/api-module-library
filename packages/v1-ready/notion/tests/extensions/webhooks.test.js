const crypto = require('crypto');
const {
    verifyNotionSignature,
    SIGNATURE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onNotionWebhookReceived,
    onNotionWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByWorkspaceId,
} = require('../../extensions/webhooks/lookup');

function sign(body, token) {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        raw,
        signature: `sha256=${crypto
            .createHmac('sha256', token)
            .update(raw)
            .digest('hex')}`,
    };
}

describe('Notion webhook signature verifier', () => {
    const token = 'secret_token';

    it('accepts a valid signature over rawBody', () => {
        const body = { type: 'page.created', workspace_id: 'ws' };
        const { raw, signature } = sign(body, token);
        const result = verifyNotionSignature({
            req: {
                headers: { [SIGNATURE_HEADER]: signature },
                rawBody: raw,
                body,
            },
            verificationToken: token,
        });
        expect(result.valid).toBe(true);
    });

    it('rejects missing signature', () => {
        const result = verifyNotionSignature({
            req: { headers: {}, body: {} },
            verificationToken: token,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/missing/);
    });
});

describe('Notion webhook handlers', () => {
    const token = 'secret_token';
    const prev = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;

    beforeEach(() => {
        process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = token;
    });
    afterAll(() => {
        if (prev === undefined) {
            delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
        } else {
            process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = prev;
        }
    });

    it('accepts the unsigned verification_token handshake', async () => {
        const res = { statusCode: null, body: null };
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (body) => {
            res.body = body;
            return res;
        };

        const ctx = { queueWebhook: jest.fn() };
        await onNotionWebhookReceived.call(ctx, {
            req: { body: { verification_token: 'secret_abc' }, headers: {} },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.verification_token_received).toBe(true);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues resolve for a signed event', async () => {
        const event = {
            id: 'evt-1',
            type: 'page.created',
            workspace_id: 'ws-1',
        };
        const { raw, signature } = sign(event, token);
        const res = { statusCode: null, body: null };
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (body) => {
            res.body = body;
            return res;
        };

        const ctx = { queueWebhook: jest.fn() };
        await onNotionWebhookReceived.call(ctx, {
            req: {
                body: event,
                rawBody: raw,
                headers: { [SIGNATURE_HEADER]: signature },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'NOTION_WEBHOOK_RESOLVE',
            body: event,
        });
    });

    it('resolve re-enqueues NOTION_WEBHOOK with integration id', async () => {
        const ctx = {
            queueWebhook: jest.fn(),
            commands: {
                findIntegrationByEntityExternalId: async () => 'integ-9',
            },
        };
        await onNotionWebhookResolve.call(ctx, {
            data: { body: { workspace_id: 'ws-1', type: 'page.created' } },
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'NOTION_WEBHOOK',
            integrationId: 'integ-9',
            body: { workspace_id: 'ws-1', type: 'page.created' },
        });
    });
});

describe('findIntegrationByWorkspaceId', () => {
    it('delegates to findIntegrationByEntityExternalId with module notion', async () => {
        const find = jest.fn(async () => 'id-1');
        const result = await findIntegrationByWorkspaceId(
            { commands: { findIntegrationByEntityExternalId: find } },
            'ws-x'
        );
        expect(result).toBe('id-1');
        expect(find).toHaveBeenCalledWith('ws-x', 'notion');
    });
});
