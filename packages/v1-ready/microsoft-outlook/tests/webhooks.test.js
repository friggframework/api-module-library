const {
    extractValidationToken,
    verifyGraphClientState,
    extractTenantId,
} = require('../extensions/webhooks/signature-verifier');
const {
    onMicrosoftOutlookWebhookReceived,
} = require('../extensions/webhooks/handlers');

describe('Outlook Graph webhook helpers', () => {
    it('extracts validationToken from query', () => {
        expect(
            extractValidationToken({ query: { validationToken: 'tok-1' } })
        ).toBe('tok-1');
        expect(
            extractValidationToken({
                url: '/webhooks?validationToken=tok-2',
            })
        ).toBe('tok-2');
    });

    it('verifies clientState on a batch', () => {
        const ok = verifyGraphClientState({
            notification: {
                value: [{ clientState: 'secret' }, { clientState: 'secret' }],
            },
            expectedClientState: 'secret',
        });
        expect(ok.valid).toBe(true);

        const bad = verifyGraphClientState({
            notification: { value: [{ clientState: 'nope' }] },
            expectedClientState: 'secret',
        });
        expect(bad.valid).toBe(false);
    });

    it('extractTenantId reads Graph tenantId', () => {
        expect(extractTenantId({ tenantId: 'tid' })).toBe('tid');
        expect(extractTenantId({})).toBeUndefined();
    });

    it('receiver echoes validationToken as text/plain', async () => {
        const sent = [];
        const res = {
            status(code) {
                sent.push(['status', code]);
                return this;
            },
            type(t) {
                sent.push(['type', t]);
                return this;
            },
            send(body) {
                sent.push(['send', body]);
            },
            json() {},
        };
        await onMicrosoftOutlookWebhookReceived.call(
            {},
            {
                req: { query: { validationToken: 'probe' }, body: {} },
                res,
            }
        );
        expect(sent).toEqual([
            ['status', 200],
            ['type', 'text/plain'],
            ['send', 'probe'],
        ]);
    });
});
