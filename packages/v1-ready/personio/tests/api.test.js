const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        company_id: '27277',
        access_token: 'tok',
        ...overrides,
    });
    // Pretend the token is fresh so ensureAccessToken does not POST.
    api.accessTokenExpire = new Date(Date.now() + 60 * 60 * 1000);
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { _data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'updated' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Personio Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and client-credentials grant', () => {
            const api = new Api({
                client_id: 'a',
                client_secret: 'b',
                company_id: '1',
            });
            expect(api.baseUrl).toBe('https://api.personio.de');
            expect(api.tokenUri).toBe('https://api.personio.de/v2/auth/token');
            expect(api.grant_type).toBe('client_credentials');
        });

        it('accepts camelCase credential aliases', () => {
            const api = new Api({
                clientId: 'x',
                clientSecret: 'y',
                companyId: '9',
            });
            expect(api.client_id).toBe('x');
            expect(api.client_secret).toBe('y');
            expect(api.company_id).toBe('9');
        });

        it('adds the Bearer auth header', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('reports authenticated with client credentials or a token', () => {
            expect(
                new Api({ client_id: 'a', client_secret: 'b' }).isAuthenticated()
            ).toBe(true);
            expect(new Api({ access_token: 't' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('getToken posts form-urlencoded client_credentials', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'csec',
                scope: 'personio:persons:read',
            });
            let captured;
            api._post = async (options) => {
                captured = options;
                return {
                    access_token: 'new-tok',
                    expires_in: 86400,
                    token_type: 'Bearer',
                };
            };
            api.setTokens = async (params) => {
                api.access_token = params.access_token;
                api.accessTokenExpire = new Date(
                    Date.now() + params.expires_in * 1000
                );
            };
            await api.getToken();
            expect(captured.url).toBe(
                'https://api.personio.de/v2/auth/token'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=client_credentials');
            expect(body).toContain('client_id=cid');
            expect(body).toContain('client_secret=csec');
            expect(body).toContain('scope=personio%3Apersons%3Aread');
            expect(api.access_token).toBe('new-tok');
        });
    });

    describe('persons', () => {
        it('listPersons hits GET /v2/persons', async () => {
            const api = makeApi();
            await api.listPersons({ limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.personio.de/v2/persons'
            );
            expect(api._captured[0].query).toEqual({ limit: 10 });
        });

        it('getPerson hits GET /v2/persons/{id}', async () => {
            const api = makeApi();
            await api.getPerson('3003');
            expect(api._captured[0].url).toBe(
                'https://api.personio.de/v2/persons/3003'
            );
        });

        it('createPerson POSTs the body', async () => {
            const api = makeApi();
            const body = { email: 'a@b.com', first_name: 'A', last_name: 'B' };
            await api.createPerson(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updatePerson PATCHes by id', async () => {
            const api = makeApi();
            await api.updatePerson('3003', { last_name: 'Updated' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toContain('/v2/persons/3003');
            expect(api._captured[0].body).toEqual({ last_name: 'Updated' });
        });

        it('deletePerson DELETEs by id', async () => {
            const api = makeApi();
            await api.deletePerson('3003');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toContain('/v2/persons/3003');
        });
    });

    describe('absences', () => {
        it('listAbsencePeriods / get / create / update / delete', async () => {
            const api = makeApi();
            await api.listAbsencePeriods({ 'person.id': '1' });
            await api.getAbsencePeriod('abc');
            await api.createAbsencePeriod({
                person: { id: '1' },
                starts_from: {},
                absence_type: { id: 't' },
            });
            await api.updateAbsencePeriod('abc', { comment: 'x' });
            await api.deleteAbsencePeriod('abc');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PATCH',
                'DELETE',
            ]);
            expect(api._captured[0].url).toContain('/v2/absence-periods');
            expect(api._captured[1].url).toContain('/v2/absence-periods/abc');
        });

        it('listAbsenceTypes and getAbsenceType', async () => {
            const api = makeApi();
            await api.listAbsenceTypes();
            await api.getAbsenceType('t1');
            expect(api._captured[0].url).toContain('/v2/absence-types');
            expect(api._captured[1].url).toContain('/v2/absence-types/t1');
        });
    });

    describe('attendances', () => {
        it('CRUD attendance periods', async () => {
            const api = makeApi();
            await api.listAttendancePeriods({ status: 'CONFIRMED' });
            await api.getAttendancePeriod('ap1');
            await api.createAttendancePeriod({
                person: { id: '1' },
                type: 'WORK',
                start: { date_time: '2024-06-07T09:00:00' },
            });
            await api.updateAttendancePeriod('ap1', { type: 'BREAK' });
            await api.deleteAttendancePeriod('ap1');
            expect(api._captured[0].url).toContain('/v2/attendance-periods');
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('webhooks', () => {
        it('CRUD webhooks and rotate signing secret', async () => {
            const api = makeApi();
            await api.listWebhooks();
            await api.getWebhook('wh-1');
            await api.createWebhook({
                url: 'https://hook.example.com',
                status: 'ENABLED',
                enabled_events: ['person.created'],
            });
            await api.updateWebhook('wh-1', { status: 'DISABLED' });
            await api.deleteWebhook('wh-1');
            await api.rotateWebhookSigningSecret('wh-1');
            expect(api._captured[0].url).toContain('/v2/webhooks');
            expect(api._captured[5].url).toContain(
                '/v2/webhooks/wh-1/signing-secret'
            );
            expect(api._captured[5].method).toBe('POST');
        });
    });

    describe('verifyWebhookSignature', () => {
        const secret =
            '5e54aea2f2746789e0a569d6208f2cf40944b3ba262f344628816bd8ea20dc28';
        const timestamp = '2026-06-24T15:00:00Z';
        const body = '{"event":"ping"}';
        const signature =
            'a8bf1302902ef5eb7e215be6609aa86462adeb7cbc378811801fea691e0f064d';

        it('accepts the official test vector', () => {
            // Freeze "now" near the test-vector timestamp so skew check passes.
            const api = new Api({});
            const near = Date.parse(timestamp);
            const realNow = Date.now;
            Date.now = () => near;
            try {
                const result = api.verifyWebhookSignature({
                    rawBody: body,
                    headers: {
                        'X-Personio-Webhook-Timestamp': timestamp,
                        'X-Personio-Webhook-Signature': signature,
                    },
                    secret,
                });
                expect(result).toEqual({ valid: true });
            } finally {
                Date.now = realNow;
            }
        });

        it('rejects a bad signature', () => {
            const api = new Api({});
            const near = Date.parse(timestamp);
            const realNow = Date.now;
            Date.now = () => near;
            try {
                const result = api.verifyWebhookSignature({
                    rawBody: body,
                    headers: {
                        'X-Personio-Webhook-Timestamp': timestamp,
                        'X-Personio-Webhook-Signature': '00'.repeat(32),
                    },
                    secret,
                });
                expect(result.valid).toBe(false);
                expect(result.reason).toBe('signature mismatch');
            } finally {
                Date.now = realNow;
            }
        });

        it('matches a locally computed HMAC', () => {
            const api = new Api({});
            const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
            const raw = '{"event_name":"person.created"}';
            const sig = crypto
                .createHmac('sha256', secret)
                .update(`${ts}.${raw}`, 'utf8')
                .digest('hex');
            const result = api.verifyWebhookSignature({
                rawBody: raw,
                headers: {
                    'x-personio-webhook-timestamp': ts,
                    'x-personio-webhook-signature': sig,
                },
                secret,
            });
            expect(result).toEqual({ valid: true });
        });
    });
});
