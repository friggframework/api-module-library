const crypto = require('crypto');
const {
    onDropboxWebhookChallenge,
    onDropboxWebhookReceived,
    onDropboxWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByDropboxAccountId,
} = require('../../extensions/webhooks/lookup');
const {
    verifyDropboxSignature,
} = require('../../extensions/webhooks/signature-verifier');

function makeRes() {
    const res = {
        statusCode: null,
        body: null,
        contentType: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        type(t) {
            this.contentType = t;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    return res;
}

describe('Dropbox webhooks extension', () => {
    it('echoes the verification challenge', async () => {
        const res = makeRes();
        await onDropboxWebhookChallenge({
            req: { query: { challenge: 'abc123' } },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(res.contentType).toBe('text/plain');
        expect(res.body).toBe('abc123');
    });

    it('rejects POST with a bad signature', async () => {
        process.env.DROPBOX_CLIENT_SECRET = 'app-secret';
        const res = makeRes();
        const ctx = {
            queueWebhook: jest.fn(),
        };
        await onDropboxWebhookReceived.call(ctx, {
            req: {
                headers: { 'x-dropbox-signature': '00'.repeat(32) },
                rawBody: '{}',
                body: {},
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues resolve jobs for each account_id on a valid POST', async () => {
        const secret = 'app-secret';
        process.env.DROPBOX_CLIENT_SECRET = secret;
        const body = {
            list_folder: {
                accounts: ['dbid:AA1', 'dbid:AA2'],
            },
        };
        const raw = JSON.stringify(body);
        const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');

        const res = makeRes();
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        await onDropboxWebhookReceived.call(ctx, {
            req: {
                headers: { 'x-dropbox-signature': sig },
                rawBody: raw,
                body,
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(queued).toHaveLength(2);
        expect(queued[0].event).toBe('DROPBOX_WEBHOOK_RESOLVE');
        expect(queued[0].body._accountId).toBe('dbid:AA1');
        expect(queued[1].body._accountId).toBe('dbid:AA2');
    });

    it('resolve looks up the integration and re-enqueues DROPBOX_WEBHOOK', async () => {
        const queued = [];
        const ctx = {
            getEntitiesForModule: async () => [
                { externalId: 'dbid:AA1', integrationId: 'int-9' },
            ],
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        await onDropboxWebhookResolve.call(ctx, {
            data: {
                body: {
                    list_folder: { accounts: ['dbid:AA1'] },
                    _accountId: 'dbid:AA1',
                },
            },
        });
        expect(queued).toEqual([
            {
                event: 'DROPBOX_WEBHOOK',
                integrationId: 'int-9',
                body: {
                    list_folder: { accounts: ['dbid:AA1'] },
                    _accountId: 'dbid:AA1',
                },
            },
        ]);
    });

    it('lookup returns null when no entity matches', async () => {
        const id = await findIntegrationByDropboxAccountId(
            { getEntitiesForModule: async () => [] },
            'dbid:missing'
        );
        expect(id).toBeNull();
    });

    it('signature verifier wraps Api.verifyWebhookSignature', () => {
        const body = '{}';
        const secret = 's';
        const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
        expect(
            verifyDropboxSignature({
                appSecret: secret,
                req: { headers: { 'x-dropbox-signature': sig }, rawBody: body },
            }).valid
        ).toBe(true);
    });
});
