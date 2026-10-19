/**
 * Request-shape tests: each method is driven through the real requester against nock, and the assertions are on
 * the captured outbound request (method, path, query, body) - not on the return value.
 */
const nock = require('nock');
const { Api } = require('../api');

const HOST = 'https://api.hubapi.com';
const makeApi = () => new Api({ access_token: 'tok', refresh_token: 'ref' });

/** Register a nock interceptor that records the request it receives. */
function capture(method, path, reply = {}, status = 200) {
    const seen = {};
    nock(HOST)
        .intercept(path, method, (b) => { seen.body = b; return true; })
        .query((q) => { seen.query = q; return true; })
        .reply(function () { seen.headers = this.req.headers; return [status, reply]; });
    return seen;
}

beforeAll(() => nock.disableNetConnect());
afterEach(() => { expect(nock.pendingMocks()).toEqual([]); nock.cleanAll(); });
afterAll(() => nock.enableNetConnect());

describe('contacts', () => {
    it('searchContacts posts filters to contacts/search', async () => {
        const seen = capture('POST', '/crm/v3/objects/contacts/search', { results: [] });
        await makeApi().searchContacts({
            email: 'a@b.co', phone: '+1555', limit: 5, lastContactedBefore: '2026-01-01T00:00:00Z', properties: ['email'],
        });
        expect(seen.body).toEqual({
            filterGroups: [{ filters: [
                { propertyName: 'email', operator: 'EQ', value: 'a@b.co' },
                { propertyName: 'phone', operator: 'EQ', value: '+1555' },
                { propertyName: 'notes_last_contacted', operator: 'LT', value: String(Date.parse('2026-01-01T00:00:00Z')) },
            ] }],
            limit: 5,
            properties: ['email'],
        });
        expect([].concat(seen.headers.authorization)).toEqual(['Bearer tok']);
    });

    it('upsertContactByEmail batch-upserts with idProperty=email and returns the first result', async () => {
        const seen = capture('POST', '/crm/v3/objects/contacts/batch/upsert', { results: [{ id: '9' }] });
        const out = await makeApi().upsertContactByEmail('a@b.co', { firstname: 'A' });
        expect(seen.body).toEqual({ inputs: [{ idProperty: 'email', id: 'a@b.co', properties: { firstname: 'A', email: 'a@b.co' } }] });
        expect(out).toEqual({ id: '9' });
    });

    it('listDealsForContact reads v4 associations then batch-reads the deals, filtering open', async () => {
        const assoc = capture('GET', '/crm/v4/objects/contacts/7/associations/deals',
            { results: [{ toObjectId: 1 }, { toObjectId: 2 }] });
        nock(HOST).get('/crm/v3/properties/deal').reply(200, { results: [{ name: 'dealname' }] });
        const read = capture('POST', '/crm/v3/objects/deals/batch/read', { results: [
            { id: '1', properties: { hs_is_closed: 'false' } },
            { id: '2', properties: { hs_is_closed: 'true' } },
        ] });
        const out = await makeApi().listDealsForContact('7', true);
        expect(assoc.query).toEqual({ limit: '500' });
        expect(read.body).toEqual({ inputs: [{ id: '1' }, { id: '2' }], properties: ['dealname', 'hs_is_closed'] });
        expect(out.map((d) => d.id)).toEqual(['1']);
    });

    it('listContactsForDeal reads v4 deal->contacts associations then batch-reads contacts', async () => {
        capture('GET', '/crm/v4/objects/deals/3/associations/contacts', { results: [{ toObjectId: 11 }] });
        nock(HOST).get('/crm/v3/properties/contact').reply(200, { results: [{ name: 'email' }] });
        const read = capture('POST', '/crm/v3/objects/contacts/batch/read', { results: [{ id: '11' }] });
        const out = await makeApi().listContactsForDeal('3');
        expect(read.body).toEqual({ inputs: [{ id: '11' }], properties: ['email'] });
        expect(out).toEqual([{ id: '11' }]);
    });
});

describe('engagements', () => {
    it('createTask posts the task with a task->contact (204) association', async () => {
        const seen = capture('POST', '/crm/v3/objects/tasks', { id: 't1' });
        await makeApi().createTask({ hs_task_subject: 'Call' }, '7');
        expect(seen.body).toEqual({
            properties: { hs_task_subject: 'Call' },
            associations: [{ to: { id: '7' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }] }],
        });
    });

    it('createTask without a contact sends no associations', async () => {
        const seen = capture('POST', '/crm/v3/objects/tasks', { id: 't1' });
        await makeApi().createTask({ hs_task_subject: 'x' });
        expect(seen.body).toEqual({ properties: { hs_task_subject: 'x' } });
    });

    it('createCallEngagement posts the call with a call->contact (194) association', async () => {
        const seen = capture('POST', '/crm/v3/objects/calls', { id: 'c1' });
        await makeApi().createCallEngagement({ hs_call_title: 'Hi' }, '7');
        expect(seen.body).toEqual({
            properties: { hs_call_title: 'Hi' },
            associations: [{ to: { id: '7' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 194 }] }],
        });
    });

    it('createNote associates to contact (202) and deal (214)', async () => {
        const seen = capture('POST', '/crm/v3/objects/notes', { id: 'n1' });
        await makeApi().createNote({ hs_note_body: 'b' }, '7', '3');
        expect(seen.body.associations).toEqual([
            { to: { id: '7' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
            { to: { id: '3' }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
        ]);
        expect(seen.body.properties).toEqual({ hs_note_body: 'b' });
    });

    it('getTaskById GETs the task with a comma-joined properties query', async () => {
        const seen = capture('GET', '/crm/v3/objects/tasks/5', { id: '5' });
        await makeApi().getTaskById('5', ['hs_task_subject', 'hs_task_status']);
        expect(seen.query).toEqual({ properties: 'hs_task_subject,hs_task_status' });
    });

    it('updateTask PATCHes the task properties', async () => {
        const seen = capture('PATCH', '/crm/v3/objects/tasks/5', { id: '5' });
        await makeApi().updateTask('5', { hs_task_status: 'COMPLETED' });
        expect(seen.body).toEqual({ properties: { hs_task_status: 'COMPLETED' } });
    });

    it('searchTasks posts due/status/owner filters', async () => {
        const seen = capture('POST', '/crm/v3/objects/tasks/search', { results: [] });
        await makeApi().searchTasks({ dueBefore: '2026-02-01T00:00:00Z', status: 'NOT_STARTED', ownerId: 12, limit: 3 });
        expect(seen.body).toEqual({
            filterGroups: [{ filters: [
                { propertyName: 'hs_timestamp', operator: 'LT', value: String(Date.parse('2026-02-01T00:00:00Z')) },
                { propertyName: 'hs_task_status', operator: 'EQ', value: 'NOT_STARTED' },
                { propertyName: 'hubspot_owner_id', operator: 'EQ', value: '12' },
            ] }],
            limit: 3,
        });
    });
});

describe('owners, pipelines, subscriptions', () => {
    it('listOwners pages /crm/v3/owners with limit and after', async () => {
        const q = [];
        nock(HOST).get('/crm/v3/owners').query((x) => { q.push(x); return true; })
            .reply(200, { results: [{ id: '1' }], paging: { next: { after: 'A' } } });
        nock(HOST).get('/crm/v3/owners').query((x) => { q.push(x); return true; })
            .reply(200, { results: [{ id: '2' }] });
        const out = await makeApi().listOwners();
        expect(q).toEqual([{ limit: '500' }, { limit: '500', after: 'A' }]);
        expect(out.map((o) => o.id)).toEqual(['1', '2']);
    });

    it('getOwnerByEmail queries owners by email and returns the first match, or null', async () => {
        const seen = capture('GET', '/crm/v3/owners', { results: [{ id: '4', email: 'a@b.co' }] });
        expect(await makeApi().getOwnerByEmail('a@b.co')).toEqual({ id: '4', email: 'a@b.co' });
        expect(seen.query).toEqual({ email: 'a@b.co' });
        capture('GET', '/crm/v3/owners', { results: [] });
        expect(await makeApi().getOwnerByEmail('none@b.co')).toBeNull();
    });

    it('listDealStages(pipelineId) GETs that pipeline and returns its stages', async () => {
        capture('GET', '/crm/v3/pipelines/deals/p1', { id: 'p1', stages: [{ id: 's1' }] });
        expect(await makeApi().listDealStages('p1')).toEqual([{ pipelineId: 'p1', id: 's1' }]);
    });

    it('listDealStages() flattens every deal pipeline', async () => {
        capture('GET', '/crm/v3/pipelines/deals', { results: [{ id: 'a', stages: [{ id: '1' }] }, { id: 'b', stages: [{ id: '2' }] }] });
        expect((await makeApi().listDealStages()).map((s) => `${s.pipelineId}:${s.id}`)).toEqual(['a:1', 'b:2']);
    });

    it('listSubscriptionDefinitions GETs the definitions and returns the array', async () => {
        capture('GET', '/communication-preferences/v3/definitions', { subscriptionDefinitions: [{ id: '1' }] });
        expect(await makeApi().listSubscriptionDefinitions()).toEqual([{ id: '1' }]);
    });

    it('unsubscribeEmail posts emailAddress, subscriptionId and legal basis', async () => {
        const seen = capture('POST', '/communication-preferences/v3/unsubscribe', { id: '1', status: 'NOT_SUBSCRIBED' });
        await makeApi().unsubscribeEmail('a@b.co', 123, 'LEGITIMATE_INTEREST_OTHER', 'asked');
        expect(seen.body).toEqual({
            emailAddress: 'a@b.co', subscriptionId: '123',
            legalBasis: 'LEGITIMATE_INTEREST_OTHER', legalBasisExplanation: 'asked',
        });
    });
});
