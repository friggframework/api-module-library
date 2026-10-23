const { Api, DEFAULT_SCOPE } = require('../api');
const {
    verifyDrChronoSignature,
    verifyWebhookSignature,
    buildWebhookChallengeResponse,
    SIGNATURE_HEADER,
    EVENT_HEADER,
} = require('../extensions/webhooks/signature-verifier');
const {
    extractWebhookEnvelope,
    onDrChronoWebhookVerify,
    onDrChronoWebhookReceived,
} = require('../extensions/webhooks/handlers');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/drchrono',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('DrChrono Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL, token URI, and default scope', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/drchrono',
            });
            expect(api.baseUrl).toBe('https://app.drchrono.com');
            expect(api.tokenUri).toBe('https://app.drchrono.com/o/token/');
            expect(api.scope).toBe(DEFAULT_SCOPE);
            expect(api.getAuthorizationUri()).toContain(
                'https://app.drchrono.com/o/authorize/'
            );
            expect(api.getAuthorizationUri()).toContain('response_type=code');
            expect(api.getAuthorizationUri()).toContain('client_id=c');
            expect(api.getAuthorizationUri()).toContain('patients%3Aread');
        });

        it('accepts an access_token from params', () => {
            const api = new Api({ access_token: 'tok' });
            expect(api.access_token).toBe('tok');
        });

        it('getAuthorizationRequirements returns oauth2', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/drchrono',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('/o/authorize/');
        });

        it('getTokenFromCode POSTs form-urlencoded to the token URI', async () => {
            const api = makeApi({ access_token: 'stale' });
            api.setTokens = async () => {};
            api._post = async (options, stringify) => {
                api._captured.push({ options, stringify });
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    expires_in: 172800,
                };
            };
            await api.getTokenFromCode('auth-code');
            const { options, stringify } = api._captured[0];
            expect(options.url).toBe('https://app.drchrono.com/o/token/');
            expect(options.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(stringify).toBe(false);
            expect(options.body.toString()).toContain('grant_type=authorization_code');
            expect(options.body.toString()).toContain('code=auth-code');
            expect(api.access_token).toBeUndefined();
        });

        it('refreshAccessToken omits redirect_uri', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            api._post = async (options) => {
                api._captured.push(options);
                return { access_token: 'a2', refresh_token: 'r2', expires_in: 1 };
            };
            await api.refreshAccessToken({ refresh_token: 'old-r' });
            const body = api._captured[0].body.toString();
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain('refresh_token=old-r');
            expect(body).not.toContain('redirect_uri');
        });
    });

    describe('patients', () => {
        it('listPatients hits GET /api/patients with cursor pagination', async () => {
            const api = makeApi();
            await api.listPatients({ page_size: 25, cursor: 'abc' });
            expect(api._captured[0].url).toContain(
                'https://app.drchrono.com/api/patients?'
            );
            expect(api._captured[0].url).toContain('page_size=25');
            expect(api._captured[0].url).toContain('cursor=abc');
        });

        it('getPatient hits GET /api/patients/{id}', async () => {
            const api = makeApi();
            await api.getPatient(99);
            expect(api._captured[0].url).toBe(
                'https://app.drchrono.com/api/patients/99'
            );
        });

        it('createPatient POSTs JSON', async () => {
            const api = makeApi();
            await api.createPatient({ first_name: 'Ada', doctor: 1, gender: 'Female' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://app.drchrono.com/api/patients'
            );
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updatePatient PATCHes JSON', async () => {
            const api = makeApi();
            await api.updatePatient(5, { email: 'a@example.com' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://app.drchrono.com/api/patients/5'
            );
        });
    });

    describe('appointments & billing', () => {
        it('listAppointments requires caller-supplied date filters', async () => {
            const api = makeApi();
            await api.listAppointments({ since: '2026-01-01' });
            expect(api._captured[0].url).toContain('/api/appointments?');
            expect(api._captured[0].url).toContain('since=2026-01-01');
        });

        it('createPatientPayment POSTs to /api/patient_payments', async () => {
            const api = makeApi();
            await api.createPatientPayment({ patient: 1, amount: 10 });
            expect(api._captured[0].url).toBe(
                'https://app.drchrono.com/api/patient_payments'
            );
        });

        it('listLineItems and listTransactions hit verified paths', async () => {
            const api = makeApi();
            await api.listLineItems({ patient: 1 });
            await api.listTransactions({});
            expect(api._captured[0].url).toContain('/api/line_items');
            expect(api._captured[1].url).toBe(
                'https://app.drchrono.com/api/transactions'
            );
        });
    });

    describe('iframe', () => {
        it('createIframeIntegration POSTs to /api/iframe_integration', async () => {
            const api = makeApi();
            await api.createIframeIntegration();
            expect(api._captured[0].url).toBe(
                'https://app.drchrono.com/api/iframe_integration'
            );
        });

        it('deleteIframeIntegration DELETEs /api/iframe_integration', async () => {
            const api = makeApi();
            await api.deleteIframeIntegration();
            expect(api._captured[0].method).toBe('DELETE');
        });
    });
});

describe('DrChrono webhook signature', () => {
    const secret = 'test-secret-token-with-entropy';

    it('accepts matching X-drchrono-signature', () => {
        const result = verifyDrChronoSignature({
            req: { headers: { [SIGNATURE_HEADER]: secret } },
            signingSecret: secret,
        });
        expect(result.valid).toBe(true);
    });

    it('rejects mismatched signature', () => {
        const result = verifyDrChronoSignature({
            req: { headers: { [SIGNATURE_HEADER]: 'wrong' } },
            signingSecret: secret,
        });
        expect(result.valid).toBe(false);
    });

    it('verifyWebhookSignature convenience wrapper works', () => {
        expect(verifyWebhookSignature(secret, secret)).toBe(true);
        expect(verifyWebhookSignature('nope', secret)).toBe(false);
    });

    it('buildWebhookChallengeResponse HMACs msg with the secret', () => {
        const crypto = require('crypto');
        const expected = crypto
            .createHmac('sha256', secret)
            .update('challenge-msg', 'utf8')
            .digest('hex');
        expect(buildWebhookChallengeResponse('challenge-msg', secret)).toEqual({
            secret_token: expected,
        });
    });

    it('extractWebhookEnvelope reads event header and object doctor', () => {
        const envelope = extractWebhookEnvelope(
            { object: { id: 9, doctor: 42 }, receiver: {} },
            { [EVENT_HEADER]: 'PATIENT_CREATE' }
        );
        expect(envelope.event).toBe('PATIENT_CREATE');
        expect(envelope.doctorId).toBe('42');
    });

    it('GET verify handler returns secret_token', async () => {
        process.env.DRCHRONO_WEBHOOK_SECRET = secret;
        const res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
            },
        };
        await onDrChronoWebhookVerify({
            req: { query: { msg: 'abc' } },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.secret_token).toBeTruthy();
        delete process.env.DRCHRONO_WEBHOOK_SECRET;
    });

    it('POST receiver rejects bad signatures', async () => {
        process.env.DRCHRONO_WEBHOOK_SECRET = secret;
        const res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
            },
        };
        await onDrChronoWebhookReceived.call(
            { queueWebhook: async () => {} },
            {
                req: {
                    headers: { [SIGNATURE_HEADER]: 'bad' },
                    body: { object: {} },
                },
                res,
            }
        );
        expect(res.statusCode).toBe(401);
        delete process.env.DRCHRONO_WEBHOOK_SECRET;
    });
});
