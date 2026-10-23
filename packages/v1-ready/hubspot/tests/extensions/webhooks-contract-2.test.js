/**
 * The contract-2 face of hubspot.extensions.webhooks (ADR-054 §2) and hubspot.fields. Core runs these pieces
 * (receipt, resolve, dispatch, subscription reconcile); here each is checked on its own, with HubSpot nock'd.
 */
const crypto = require('crypto');
const nock = require('nock');
const hubspot = require('../../index');
const { Api } = require('../../api');

const webhooks = hubspot.extensions.webhooks;
const SECRET = 'client-secret';
const URL_SIGNED = 'https://hooks.example.com/api/deal-alerts-integration/crm-webhooks/webhooks?x=1';

/** The delivery as core hands it to verify: IntegrationBase#webhookVerificationInput's shape. */
function signedInput(events, { secret = SECRET, timestamp = Date.now(), url = URL_SIGNED } = {}) {
    const rawBody = JSON.stringify(events);
    const signature = crypto.createHmac('sha256', secret).update(`POST${url}${rawBody}${timestamp}`, 'utf8').digest('base64');
    return {
        method: 'POST', url, rawBody, body: events, query: {},
        headers: { host: 'internal:3000', 'x-hubspot-signature-v3': signature, 'x-hubspot-request-timestamp': String(timestamp) },
    };
}

beforeAll(() => nock.disableNetConnect());
afterEach(() => nock.cleanAll());
afterAll(() => nock.enableNetConnect());

describe('bundle', () => {
    it('is contract 2 and keeps its contract-1 face for hand-bound integrations', () => {
        expect(webhooks).toMatchObject({ name: 'hubspot-webhooks', contract: 2, useDatabase: false, resolve: { module: 'hubspot' } });
        expect(webhooks.routes).toEqual([{ path: '/webhooks', method: 'POST', event: 'HUBSPOT_WEBHOOK_RECEIVED' }]);
        expect(Object.keys(webhooks.events)).toEqual(['HUBSPOT_WEBHOOK_RECEIVED', 'HUBSPOT_WEBHOOK_RESOLVE', 'HUBSPOT_WEBHOOK']);
        expect(Object.keys(webhooks.emits)).toEqual(expect.arrayContaining(['deal.created', 'deal.changed', 'deal.deleted', 'contact.changed', 'company.created']));
        expect(webhooks.env).toEqual(['HUBSPOT_CLIENT_SECRET', 'HUBSPOT_APP_ID', 'HUBSPOT_DEVELOPER_API_KEY']);
        expect(webhooks.options.required).toEqual(['subscribe']);
    });
});

describe('verify (at receipt)', () => {
    const env = { HUBSPOT_CLIENT_SECRET: SECRET };

    it('accepts a v3 signature over the public URL, method, raw body and timestamp', () => {
        expect(webhooks.verify(signedInput([{ portalId: 1 }]), { env })).toEqual({ valid: true });
    });

    it('rejects a wrong secret, a stale timestamp and a missing secret, with a reason', () => {
        expect(webhooks.verify(signedInput([{ portalId: 1 }], { secret: 'other' }), { env })).toEqual({ valid: false, reason: 'signature mismatch' });
        expect(webhooks.verify(signedInput([{ portalId: 1 }], { timestamp: Date.now() - 10 * 60 * 1000 }), { env }).reason).toMatch(/skew/);
        expect(webhooks.verify(signedInput([{ portalId: 1 }]), { env: {} })).toEqual({ valid: false, reason: 'missing client secret' });
    });

    it('signs the raw bytes, not a re-serialised body', () => {
        const input = signedInput([{ portalId: 1 }]);
        input.rawBody = input.rawBody.replace(':', ': ');
        expect(webhooks.verify(input, { env }).valid).toBe(false);
    });
});

describe('receive', () => {
    it('makes one item per event, keyed by portalId (the entity externalId)', () => {
        const events = [{ portalId: 7, objectId: 1 }, { portalId: 8, objectId: 2 }];
        expect(webhooks.receive({ body: events })).toEqual([{ externalId: 7, body: events[0] }, { externalId: 8, body: events[1] }]);
        expect(webhooks.receive({ body: { not: 'a batch' } })).toEqual([]);
    });
});

describe('normalize (in the worker, with the installation api)', () => {
    const api = () => new Api({ access_token: 'token' });

    it('turns a dealstage change into deal.changed { deal, changes }, hydrated with the listed properties', async () => {
        const scope = nock('https://api.hubapi.com', { reqheaders: { authorization: 'Bearer token' } })
            .post('/crm/v3/objects/deals/batch/read', { inputs: [{ id: '9' }], properties: ['dealname', 'amount'] })
            .reply(200, { results: [{ id: '9', properties: { dealname: 'Big', amount: '10' } }] });
        const a = api();
        const event = { portalId: 77, objectId: 9, subscriptionType: 'deal.propertyChange', propertyName: 'dealstage', propertyValue: 'closedwon' };
        const out = await webhooks.normalize([event], { api: a, options: { hydrate: ['dealname', 'amount'] } });
        expect(out).toEqual([{ name: 'deal.changed', payload: { deal: { id: '9', properties: { dealname: 'Big', amount: '10' } }, changes: { dealstage: { to: 'closedwon' } }, event } }]);
        expect(scope.isDone()).toBe(true);
        expect(a.urls.record('deal', '9')).toBe('https://app.hubspot.com/contacts/77/record/0-3/9');
    });

    it('without hydrate, the record carries what the event says; deletions are never read; unknown types are dropped', async () => {
        const events = [
            { portalId: 1, objectId: 2, subscriptionType: 'contact.creation' },
            { portalId: 1, objectId: 3, subscriptionType: 'company.deletion' },
            { portalId: 1, objectId: 4, subscriptionType: 'deal.merge' },
        ];
        const out = await webhooks.normalize(events, { api: api(), options: { hydrate: false } });
        expect(out.map((e) => e.name)).toEqual(['contact.created', 'company.deleted']);
        expect(out[0].payload.contact).toEqual({ id: '2', properties: {} });
    });
});

describe('subscriptions (app scope)', () => {
    const env = { HUBSPOT_APP_ID: 'app-1', HUBSPOT_DEVELOPER_API_KEY: 'dev-key' };
    let originalFetch;
    beforeEach(() => { originalFetch = global.fetch; });
    afterEach(() => { global.fetch = originalFetch; });

    it('keys subscriptions as eventType[:propertyName], the form use() options list', () => {
        expect(webhooks.subscriptions.key({ id: '1', eventType: 'deal.propertyChange', propertyName: 'dealstage' })).toBe('deal.propertyChange:dealstage');
        expect(webhooks.subscriptions.key({ id: '2', eventType: 'deal.creation' })).toBe('deal.creation');
        expect(webhooks.subscriptions.desired({ subscribe: ['deal.creation'] })).toEqual(['deal.creation']);
    });

    it('lists, creates and removes through the developer-app Subscriptions API', async () => {
        const calls = [];
        global.fetch = jest.fn(async (url, init) => {
            calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body), auth: init.headers.Authorization });
            const results = init.method === 'GET' ? { results: [{ id: '5', eventType: 'deal.creation' }] } : { id: '6' };
            return { ok: true, status: init.method === 'POST' ? 201 : 200, json: async () => results, text: async () => '' };
        });
        const a = new Api({});
        expect(await webhooks.subscriptions.list(a, env)).toEqual([{ id: '5', eventType: 'deal.creation' }]);
        await webhooks.subscriptions.create(a, env, 'deal.propertyChange:dealstage');
        await webhooks.subscriptions.remove(a, env, { id: '5' });
        expect(calls).toEqual([
            { url: 'https://api.hubapi.com/webhooks/v3/app-1/subscriptions', method: 'GET', body: undefined, auth: 'Bearer dev-key' },
            { url: 'https://api.hubapi.com/webhooks/v3/app-1/subscriptions', method: 'POST', body: { eventType: 'deal.propertyChange', propertyName: 'dealstage', active: true }, auth: 'Bearer dev-key' },
            { url: 'https://api.hubapi.com/webhooks/v3/app-1/subscriptions/5', method: 'DELETE', body: undefined, auth: 'Bearer dev-key' },
        ]);
    });
});

describe('fields', () => {
    it('dealStages loads "Pipeline: Stage" choices with the installation credential', async () => {
        nock('https://api.hubapi.com').get('/crm/v3/pipelines/deals').reply(200, { results: [{ id: 'p1', label: 'Sales', stages: [{ id: 'closedwon', label: 'Won' }] }] });
        const f = hubspot.fields.dealStages({ title: 'Alert when a deal enters', multiple: true, default: ['closedwon'] });
        expect(f).toMatchObject({ module: 'hubspot', required: false, schema: { type: 'array', title: 'Alert when a deal enters', items: { type: 'string' }, default: ['closedwon'] } });
        expect(await f.options(new Api({ access_token: 't' }))).toEqual([{ const: 'closedwon', title: 'Sales: Won' }]);
    });

    it('dealPipelines is a single choice', async () => {
        nock('https://api.hubapi.com').get('/crm/v3/pipelines/deals').reply(200, { results: [{ id: 'p1', label: 'Sales', stages: [] }] });
        const f = hubspot.fields.dealPipelines({ required: true });
        expect(f.schema).toEqual({ type: 'string', title: 'Pipeline' });
        expect(await f.options(new Api({ access_token: 't' }))).toEqual([{ const: 'p1', title: 'Sales' }]);
    });
});

describe('admin script', () => {
    it('is exported as a module script with prune, dryRun and the CLI flags', () => {
        const [Script] = hubspot.scripts;
        expect(Script.Definition).toMatchObject({ name: 'hubspot.reconcile-subscriptions', config: { requireIntegrationInstance: false } });
        expect(Object.keys(Script.Definition.inputSchema.properties)).toEqual(['prune', 'dryRun', 'args']);
    });

    it('runs core\'s reconcile for this extension, and says so when core is too old', async () => {
        const [Script] = hubspot.scripts;
        const execute = jest.fn(async (input) => ({ ran: input }));
        const create = jest.fn(() => class { execute(input) { return execute(input); } });
        jest.resetModules();
        jest.doMock('@friggframework/core', () => ({ createReconcileSubscriptionsScript: create }));
        const { ReconcileHubSpotSubscriptions } = require('../../scripts/reconcile-subscriptions');
        expect(await new ReconcileHubSpotSubscriptions().execute({ args: ['--dry-run'] })).toEqual({ ran: { args: ['--dry-run'] } });
        expect(create).toHaveBeenCalledWith({ name: 'hubspot.reconcile-subscriptions', extension: 'hubspot-webhooks' });
        jest.resetModules();
        jest.doMock('@friggframework/core', () => ({}));
        const { ReconcileHubSpotSubscriptions: OnOldCore } = require('../../scripts/reconcile-subscriptions');
        await expect(new OnOldCore().execute({})).rejects.toThrow(/needs @friggframework\/core with defineIntegration/);
        jest.dontMock('@friggframework/core');
        expect(Script.Definition.name).toBe('hubspot.reconcile-subscriptions');
    });
});
