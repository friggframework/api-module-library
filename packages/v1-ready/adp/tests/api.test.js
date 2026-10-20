const https = require('https');
const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        ssl_cert: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
        ssl_key: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
        access_token: 'tok',
        ...overrides,
    });
    // Avoid minting tokens in unit tests.
    api.accessTokenExpire = new Date(Date.now() + 60 * 60 * 1000);
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { workers: [], events: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new-tok', expires_in: 3600 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('ADP Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and token URI', () => {
            const api = new Api({ client_id: 'a', client_secret: 'b' });
            expect(api.baseUrl).toBe('https://api.adp.com');
            expect(api.tokenUri).toBe(
                'https://accounts.adp.com/auth/oauth/v2/token'
            );
            expect(api.grant_type).toBe('client_credentials');
        });

        it('builds an https.Agent when cert and key are provided', () => {
            const api = makeApi();
            expect(api.agent).toBeInstanceOf(https.Agent);
        });

        it('reports authenticated with token or client credentials', () => {
            expect(
                new Api({ access_token: 't' }).isAuthenticated()
            ).toBe(true);
            expect(
                new Api({
                    client_id: 'a',
                    client_secret: 'b',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('getAuthorizationRequirements returns an apiKey-style form', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'ssl_cert',
                    'ssl_key',
                ])
            );
        });

        it('getToken posts client_credentials with Basic auth to accounts.adp.com', async () => {
            const api = makeApi({ access_token: null });
            api.accessTokenExpire = null;
            await api.getToken();
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://accounts.adp.com/auth/oauth/v2/token'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.headers.Authorization).toBe(
                `Basic ${Buffer.from('cid:csecret').toString('base64')}`
            );
            expect(captured.body.get('grant_type')).toBe('client_credentials');
        });
    });

    describe('workers', () => {
        it('listWorkers hits GET /hr/v2/workers', async () => {
            const api = makeApi();
            await api.listWorkers({ $top: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/hr/v2/workers'
            );
            expect(api._captured[0].query).toEqual({ $top: 10 });
        });

        it('getWorkersMeta hits GET /hr/v2/workers/meta', async () => {
            const api = makeApi();
            await api.getWorkersMeta();
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/hr/v2/workers/meta'
            );
        });

        it('getWorker hits GET /hr/v2/workers/{associateOid}', async () => {
            const api = makeApi();
            await api.getWorker('G3Q7JN6K3CNJJRQH');
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/hr/v2/workers/G3Q7JN6K3CNJJRQH'
            );
        });
    });

    describe('worker demographics', () => {
        it('listWorkerDemographics hits the demographics collection', async () => {
            const api = makeApi();
            await api.listWorkerDemographics({ $top: 5 });
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/hr/v2/worker-demographics'
            );
        });

        it('getWorkerDemographic hits a single demographic', async () => {
            const api = makeApi();
            await api.getWorkerDemographic('AOID1');
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/hr/v2/worker-demographics/AOID1'
            );
        });

        it('getWorkerDemographicsMeta hits meta', async () => {
            const api = makeApi();
            await api.getWorkerDemographicsMeta();
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/hr/v2/worker-demographics/meta'
            );
        });
    });

    describe('worker events', () => {
        it('readWorker POSTs to /events/hr/v1/worker.read', async () => {
            const api = makeApi();
            const body = { events: [{ data: { transform: {} } }] };
            await api.readWorker(body);
            const c = api._captured[0];
            expect(c.method).toBe('POST');
            expect(c.url).toBe('https://api.adp.com/events/hr/v1/worker.read');
            expect(c.body).toEqual(body);
        });

        it('hireWorker POSTs to /events/hr/v1/worker.hire', async () => {
            const api = makeApi();
            await api.hireWorker({ events: [] });
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/events/hr/v1/worker.hire'
            );
        });

        it('changeWorkerLegalName POSTs to legal-name.change', async () => {
            const api = makeApi();
            await api.changeWorkerLegalName({ events: [] });
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/events/hr/v1/worker.legal-name.change'
            );
        });

        it('changeWorkerBaseRemuneration POSTs to base-remuneration.change', async () => {
            const api = makeApi();
            await api.changeWorkerBaseRemuneration({ events: [] });
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/events/hr/v1/worker.work-assignment.base-remuneration.change'
            );
        });

        it('getWorkerReadMeta hits worker.read/meta', async () => {
            const api = makeApi();
            await api.getWorkerReadMeta();
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/events/hr/v1/worker.read/meta'
            );
        });
    });

    describe('event notifications', () => {
        it('listEventNotificationMessages hits the queue', async () => {
            const api = makeApi();
            await api.listEventNotificationMessages();
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/core/v1/event-notification-messages'
            );
        });

        it('deleteEventNotificationMessage DELETEs by event id', async () => {
            const api = makeApi();
            await api.deleteEventNotificationMessage('12345643345');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/core/v1/event-notification-messages/12345643345'
            );
        });

        it('getEventNotificationDetails resolves relative callback hrefs', async () => {
            const api = makeApi();
            await api.getEventNotificationDetails(
                '/events/hr/v1/worker.hire/5f3d1d4895d89c19d8ae3034'
            );
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/events/hr/v1/worker.hire/5f3d1d4895d89c19d8ae3034'
            );
        });

        it('getEventNotificationDetails accepts absolute URLs', async () => {
            const api = makeApi();
            await api.getEventNotificationDetails(
                'https://api.adp.com/events/hr/v1/worker.hire/abc'
            );
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/events/hr/v1/worker.hire/abc'
            );
        });
    });

    describe('codelists', () => {
        it('getCodelist hits the WFN/1 validation table path', async () => {
            const api = makeApi();
            await api.getCodelist('departments');
            expect(api._captured[0].url).toBe(
                'https://api.adp.com/codelists/hr/v3/worker-management/departments/WFN/1'
            );
        });
    });
});
