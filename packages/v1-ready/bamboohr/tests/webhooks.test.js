const crypto = require('crypto');
const {
    verifyBambooHRWebhookSignature,
} = require('../extensions/webhooks/signature-verifier');
const {
    extractCompanyKey,
    resolveIntegrationForCompany,
} = require('../extensions/webhooks/lookup');
const {
    onBambooHRWebhookReceived,
} = require('../extensions/webhooks/handlers');

describe('BambooHR webhook signature', () => {
    const privateKey = 'test-private-key';
    const body = JSON.stringify({
        employees: [{ id: '1', changedFields: ['firstName'] }],
    });
    const timestamp = '1710000000';

    function signedReq(overrides = {}) {
        const signature = crypto
            .createHmac('sha256', privateKey)
            .update(body + timestamp, 'utf8')
            .digest('hex');
        return {
            rawBody: body,
            body: JSON.parse(body),
            headers: {
                'X-BambooHR-Signature': signature,
                'X-BambooHR-Timestamp': timestamp,
            },
            ...overrides,
        };
    }

    it('accepts a valid HMAC of rawBody+timestamp', () => {
        const result = verifyBambooHRWebhookSignature(
            signedReq(),
            privateKey
        );
        expect(result.valid).toBe(true);
    });

    it('rejects a bad signature', () => {
        const req = signedReq();
        req.headers['X-BambooHR-Signature'] = 'deadbeef';
        const result = verifyBambooHRWebhookSignature(req, privateKey);
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it('rejects missing privateKey', () => {
        const result = verifyBambooHRWebhookSignature(signedReq(), null);
        expect(result.valid).toBe(false);
    });
});

describe('BambooHR webhook lookup', () => {
    it('extracts companyDomain from body', () => {
        expect(extractCompanyKey({ companyDomain: 'acme' })).toBe('acme');
    });

    it('extracts data.companyId from event payloads', () => {
        expect(
            extractCompanyKey({
                type: 'employee.updated',
                data: { companyId: '99', employeeId: '1' },
            })
        ).toBe('99');
    });

    it('resolveIntegrationForCompany throws on ambiguity', async () => {
        await expect(
            resolveIntegrationForCompany(
                {
                    findIntegrationsByExternalEntityId: async () => [
                        { id: 'a' },
                        { id: 'b' },
                    ],
                },
                'acme'
            )
        ).rejects.toThrow(/ambiguous/i);
    });

    it('resolveIntegrationForCompany returns the single match', async () => {
        const match = await resolveIntegrationForCompany(
            {
                findIntegrationsByExternalEntityId: async () => [
                    { id: 'int-1' },
                ],
            },
            'acme'
        );
        expect(match.id).toBe('int-1');
    });
});

describe('BambooHR webhook received handler', () => {
    const privateKey = 'pk';
    const bodyObj = {
        type: 'employee.created',
        data: { companyId: '55', employeeId: '9' },
    };
    const body = JSON.stringify(bodyObj);
    const timestamp = '1710000001';
    const signature = crypto
        .createHmac('sha256', privateKey)
        .update(body + timestamp, 'utf8')
        .digest('hex');

    beforeEach(() => {
        process.env.BAMBOOHR_WEBHOOK_PRIVATE_KEY = privateKey;
    });

    afterEach(() => {
        delete process.env.BAMBOOHR_WEBHOOK_PRIVATE_KEY;
    });

    it('enqueues resolve on valid signature', async () => {
        const res = {
            headersSent: false,
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
        };
        const result = await onBambooHRWebhookReceived({
            req: {
                rawBody: body,
                body: bodyObj,
                headers: {
                    'x-bamboohr-signature': signature,
                    'x-bamboohr-timestamp': timestamp,
                },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(result.enqueue.event).toBe('BAMBOOHR_WEBHOOK_RESOLVE');
        expect(result.enqueue.data.companyKey).toBe('55');
    });
});
