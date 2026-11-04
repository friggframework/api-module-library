const {
    verifyOpenDentalEvent,
} = require('../../extensions/webhooks/signature-verifier');
const {
    extractEventMeta,
    onOpenDentalWebhookReceived,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByCustomerKey,
} = require('../../extensions/webhooks/lookup');
const crypto = require('crypto');

describe('Open Dental webhook extension', () => {
    describe('verifyOpenDentalEvent', () => {
        it('accepts a matching CustomerKey Authorization header', () => {
            const result = verifyOpenDentalEvent({
                req: { headers: { authorization: 'cust-secret' } },
                customerKey: 'cust-secret',
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a mismatched key', () => {
            const result = verifyOpenDentalEvent({
                req: { headers: { Authorization: 'wrong' } },
                customerKey: 'cust-secret',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/mismatch/i);
        });

        it('strips an accidental ODFHIR prefix and compares the customer segment', () => {
            const result = verifyOpenDentalEvent({
                req: {
                    headers: { authorization: 'ODFHIR DEV/cust-secret' },
                },
                customerKey: 'cust-secret',
            });
            expect(result.valid).toBe(true);
        });
    });

    describe('extractEventMeta', () => {
        it('reads CustomerKey, Event-Type, and Workstation headers', () => {
            const meta = extractEventMeta({
                headers: {
                    Authorization: 'cust-1',
                    'Event-Type': 'WatchTable: Appointment',
                    Workstation: 'MOLLYR',
                },
                body: [{ AptNum: 1 }],
            });
            expect(meta.customerKey).toBe('cust-1');
            expect(meta.eventType).toBe('WatchTable: Appointment');
            expect(meta.workstation).toBe('MOLLYR');
            expect(meta.body).toEqual([{ AptNum: 1 }]);
        });
    });

    describe('onOpenDentalWebhookReceived', () => {
        it('queues resolve when Authorization is present (multi-tenant)', async () => {
            const queued = [];
            const ctx = {
                queueWebhook: async (job) => queued.push(job),
            };
            const res = {
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
            delete process.env.OPENDENTAL_CUSTOMER_KEY;
            await onOpenDentalWebhookReceived.call(ctx, {
                req: {
                    headers: { authorization: 'office-key' },
                    body: [{ PatNum: 1 }],
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(queued[0].event).toBe('OPENDENTAL_WEBHOOK_RESOLVE');
            expect(queued[0].body.customerKey).toBe('office-key');
        });

        it('rejects when Authorization is missing', async () => {
            const ctx = { queueWebhook: async () => {} };
            const res = {
                statusCode: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json() {
                    return this;
                },
            };
            await onOpenDentalWebhookReceived.call(ctx, {
                req: { headers: {}, body: {} },
                res,
            });
            expect(res.statusCode).toBe(401);
        });
    });

    describe('findIntegrationByCustomerKey', () => {
        it('looks up sha256(customerKey) as externalId', async () => {
            const calls = [];
            const integration = {
                commands: {
                    findIntegrationByEntityExternalId: async (id, module) => {
                        calls.push({ id, module });
                        return 'int-1';
                    },
                },
            };
            const result = await findIntegrationByCustomerKey(
                integration,
                'cust-xyz'
            );
            expect(result).toBe('int-1');
            expect(calls[0].module).toBe('opendental');
            expect(calls[0].id).toBe(
                crypto.createHash('sha256').update('cust-xyz').digest('hex')
            );
        });
    });
});
