const {
    verifyChargebeeBasicAuth,
} = require('../extensions/webhooks/signature-verifier');
const {
    onChargebeeWebhookReceived,
    onChargebeeWebhookResolve,
    extractSite,
} = require('../extensions/webhooks/handlers');

function basicHeader(user, pass) {
    return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('Chargebee webhook Basic Auth verifier', () => {
    it('accepts matching credentials', () => {
        const result = verifyChargebeeBasicAuth({
            req: {
                headers: { authorization: basicHeader('hook', 'secret') },
            },
            username: 'hook',
            password: 'secret',
        });
        expect(result.valid).toBe(true);
    });

    it('rejects missing or wrong credentials', () => {
        expect(
            verifyChargebeeBasicAuth({
                req: { headers: {} },
                username: 'hook',
                password: 'secret',
            }).valid
        ).toBe(false);
        expect(
            verifyChargebeeBasicAuth({
                req: {
                    headers: { authorization: basicHeader('hook', 'nope') },
                },
                username: 'hook',
                password: 'secret',
            }).valid
        ).toBe(false);
    });
});

describe('Chargebee webhook handlers', () => {
    const prevUser = process.env.CHARGEBEE_WEBHOOK_USERNAME;
    const prevPass = process.env.CHARGEBEE_WEBHOOK_PASSWORD;

    beforeEach(() => {
        process.env.CHARGEBEE_WEBHOOK_USERNAME = 'hook';
        process.env.CHARGEBEE_WEBHOOK_PASSWORD = 'secret';
    });

    afterAll(() => {
        if (prevUser === undefined) delete process.env.CHARGEBEE_WEBHOOK_USERNAME;
        else process.env.CHARGEBEE_WEBHOOK_USERNAME = prevUser;
        if (prevPass === undefined) delete process.env.CHARGEBEE_WEBHOOK_PASSWORD;
        else process.env.CHARGEBEE_WEBHOOK_PASSWORD = prevPass;
    });

    it('extractSite prefers query.site', () => {
        expect(
            extractSite({ query: { site: 'acme-test' } }, { site: 'other' })
        ).toBe('acme-test');
    });

    it('RECEIVED verifies auth, requires site, and enqueues RESOLVE', async () => {
        const queued = [];
        const ctx = {
            queueWebhook: async (payload) => queued.push(payload),
        };
        const res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.body = body;
                return this;
            },
        };
        await onChargebeeWebhookReceived.call(ctx, {
            req: {
                headers: { authorization: basicHeader('hook', 'secret') },
                query: { site: 'acme-test' },
                body: { id: 'ev_1', event_type: 'subscription_created' },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(queued[0].event).toBe('CHARGEBEE_WEBHOOK_RESOLVE');
        expect(queued[0].body.site).toBe('acme-test');
        expect(queued[0].body.id).toBe('ev_1');
    });

    it('RESOLVE looks up site and enqueues CHARGEBEE_WEBHOOK', async () => {
        const queued = [];
        const ctx = {
            commands: {
                findIntegrationByEntityExternalId: async (site, moduleName) => {
                    expect(site).toBe('acme-test');
                    expect(moduleName).toBe('chargebee');
                    return 'integration-123';
                },
            },
            queueWebhook: async (payload) => queued.push(payload),
        };
        await onChargebeeWebhookResolve.call(ctx, {
            data: {
                body: { site: 'acme-test', id: 'ev_1' },
            },
        });
        expect(queued[0]).toEqual({
            event: 'CHARGEBEE_WEBHOOK',
            integrationId: 'integration-123',
            body: { site: 'acme-test', id: 'ev_1' },
        });
    });
});
