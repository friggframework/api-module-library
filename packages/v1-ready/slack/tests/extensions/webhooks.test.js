const crypto = require('crypto');
const {
    onSlackWebhookReceived,
    onSlackWebhookResolve,
    extractTeamId,
} = require('../../extensions/webhooks/handlers');
const {
    verifySlackSignature,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByTeamId,
} = require('../../extensions/webhooks/lookup');

const SECRET = 'test-slack-signing-secret';
const TS = 1531420618;
const BODY_OBJ = {
    type: 'event_callback',
    team_id: 'T123',
    event: { type: 'message', text: 'hi', channel: 'C1' },
    event_id: 'Ev1',
};
const BODY = JSON.stringify(BODY_OBJ);
const sign = (body = BODY, ts = TS) =>
    'v0=' +
    crypto.createHmac('sha256', SECRET).update(`v0:${ts}:${body}`).digest('hex');

function signedReq(bodyObj = BODY_OBJ, over = {}) {
    const raw = JSON.stringify(bodyObj);
    return {
        headers: {
            'X-Slack-Signature': sign(raw),
            'X-Slack-Request-Timestamp': String(TS),
            ...(over.headers || {}),
        },
        body: bodyObj,
        rawBody: raw,
        ...over,
    };
}

describe('Slack webhook helpers', () => {
    beforeEach(() => {
        process.env.SLACK_SIGNING_SECRET = SECRET;
        jest.spyOn(Date, 'now').mockReturnValue(TS * 1000);
    });
    afterEach(() => {
        delete process.env.SLACK_SIGNING_SECRET;
        jest.restoreAllMocks();
    });

    it('verifySlackSignature accepts a genuine delivery', async () => {
        const result = await verifySlackSignature({
            req: signedReq(),
            signingSecret: SECRET,
        });
        expect(result.valid).toBe(true);
    });

    it('verifySlackSignature rejects a bad signature', async () => {
        const req = signedReq();
        req.headers['X-Slack-Signature'] = 'v0=deadbeef';
        const result = await verifySlackSignature({
            req,
            signingSecret: SECRET,
        });
        expect(result.valid).toBe(false);
    });

    it('extractTeamId reads team_id from Events API envelopes', () => {
        expect(extractTeamId(BODY_OBJ)).toBe('T123');
        expect(extractTeamId({ team: { id: 'T9' } })).toBe('T9');
        expect(extractTeamId({})).toBeNull();
    });
});

describe('Slack webhook handlers', () => {
    beforeEach(() => {
        process.env.SLACK_SIGNING_SECRET = SECRET;
        jest.spyOn(Date, 'now').mockReturnValue(TS * 1000);
    });
    afterEach(() => {
        delete process.env.SLACK_SIGNING_SECRET;
        jest.restoreAllMocks();
    });

    it('url_verification returns the challenge', async () => {
        const challengeBody = {
            type: 'url_verification',
            challenge: 'challenge-token',
            token: 'legacy',
        };
        const req = signedReq(challengeBody);
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const ctx = { queueWebhook: jest.fn() };
        await onSlackWebhookReceived.call(ctx, { req, res });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            challenge: 'challenge-token',
        });
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues SLACK_WEBHOOK_RESOLVE for a signed event_callback', async () => {
        const req = signedReq();
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const ctx = { queueWebhook: jest.fn().mockResolvedValue(undefined) };
        await onSlackWebhookReceived.call(ctx, { req, res });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'SLACK_WEBHOOK_RESOLVE',
            body: { teamId: 'T123', event: BODY_OBJ },
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects unsigned requests with 401', async () => {
        const req = signedReq();
        req.headers['X-Slack-Signature'] = 'v0=nope';
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const ctx = { queueWebhook: jest.fn() };
        await onSlackWebhookReceived.call(ctx, { req, res });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('resolve re-enqueues SLACK_WEBHOOK for the matching integration', async () => {
        const ctx = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('int-1'),
            },
            queueWebhook: jest.fn().mockResolvedValue(undefined),
        };
        await onSlackWebhookResolve.call(ctx, {
            data: { body: { teamId: 'T123', event: BODY_OBJ } },
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'SLACK_WEBHOOK',
            integrationId: 'int-1',
            body: { teamId: 'T123', event: BODY_OBJ },
        });
    });

    it('findIntegrationByTeamId requires commands wiring', async () => {
        await expect(findIntegrationByTeamId({}, 'T1')).rejects.toThrow(
            /findIntegrationByEntityExternalId/
        );
    });
});
