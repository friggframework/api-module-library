/**
 * Asserts the OUTBOUND HTTP request for each capability-manifest method.
 * Real jsforce, real Api; only the network is faked, through jsforce's own
 * undici dispatcher (jsforce 3 uses undici, which nock does not intercept).
 * A return value alone proves nothing here, so every test checks method,
 * path, query and body.
 */
// jsforce reads the proxy env vars when it is first required and would then bypass the mock dispatcher.
for (const k of ['https_proxy', 'http_proxy', 'HTTPS_PROXY', 'HTTP_PROXY']) delete process.env[k];

// jest 28's vm context lacks Symbol.dispose, which jsforce's undici needs on Node >= 20
// (undici does `addAbortListener(...)[Symbol.dispose]`). Borrow Node's own symbol.
if (!Symbol.dispose) {
    const handle = require('events').addAbortListener(new AbortController().signal, () => {});
    const sym = [...Object.getOwnPropertySymbols(handle), ...Object.getOwnPropertySymbols(Object.getPrototypeOf(handle) || {})].find(
        (x) => x.description === 'nodejs.dispose'
    );
    if (sym) Symbol.dispose = sym;
}

const jsforceRequest = require('jsforce/lib/request');
const { MockAgent } = require(require.resolve('undici', {
    paths: [require.resolve('jsforce')],
}));
const { Api } = require('../api');

const INSTANCE = 'https://acme.my.salesforce.com';

const makeApi = () =>
    new Api({
        client_id: 'cid',
        client_secret: 'secret',
        redirect_uri: 'http://localhost/redirect/salesforce',
        access_token: 'tok',
        refresh_token: 'ref',
        instanceUrl: INSTANCE,
        delegate: { notify: jest.fn(), addDelegate: jest.fn(), delegateTypes: [] },
    });

// Every request the mock network sees: method, path (with query), parsed body.
const captured = [];
let pool;

// Reply to any request whose path matches `pathRe` with `status` and `json`.
const reply = (method, pathRe, status, json) =>
    pool
        .intercept({ method, path: (p) => pathRe.test(p) })
        .reply(status, async (opts) => {
            // jsforce sends PATCH/POST bodies as a stream; read it to a string.
            let raw = '';
            if (typeof opts.body === 'string') raw = opts.body;
            else if (opts.body) {
                const chunks = [];
                for await (const c of opts.body) chunks.push(Buffer.from(c));
                raw = Buffer.concat(chunks).toString('utf8');
            }
            captured.push({
                method: opts.method,
                uri: opts.path,
                body: raw ? JSON.parse(raw) : undefined,
                auth: opts.headers?.authorization ?? opts.headers?.Authorization,
            });
            return json === undefined ? '' : JSON.stringify(json);
        }, { headers: { 'content-type': 'application/json' } })
        .persist();

const queryParam = (uri, name) => new URL(INSTANCE + uri).searchParams.get(name);

describe('Salesforce capability-manifest methods', () => {
    let api;

    beforeEach(() => {
        captured.length = 0;
        const agent = new MockAgent();
        agent.disableNetConnect();
        pool = agent.get(INSTANCE);
        jsforceRequest.setDispatcher(agent);
        api = makeApi();
    });
    afterEach(() => {
        jsforceRequest.setDispatcher(undefined);
    });

    describe.each([
        ['updateLead', 'Lead'],
        ['updateEvent', 'Event'],
        ['updateOpportunity', 'Opportunity'],
    ])('%s(id, fields)', (method, sobject) => {
        it(`PATCHes /sobjects/${sobject}/{id} with the fields and no Id in the body`, async () => {
            reply('PATCH', new RegExp(`/sobjects/${sobject}/00Q000000000001$`), 204);

            await api[method]('00Q000000000001', { Status: 'Working', Description: 'x' });

            expect(captured).toHaveLength(1);
            expect(captured[0].method).toBe('PATCH');
            expect(captured[0].uri).toMatch(
                new RegExp(`^/services/data/v[\\d.]+/sobjects/${sobject}/00Q000000000001$`)
            );
            expect(captured[0].body).toEqual({ Status: 'Working', Description: 'x' });
            expect(captured[0].auth).toBe('Bearer tok');
        });

        it('refuses a missing id rather than sending a request', async () => {
            await expect(api[method](undefined, { A: 1 })).rejects.toThrow(/id is required/);
            expect(captured).toHaveLength(0);
        });
    });

    describe('searchPeopleByEmail(email)', () => {
        it('issues one SOSL search over EMAIL FIELDS returning Lead and Contact', async () => {
            reply('GET', /\/search\?/, 200, {
                searchRecords: [
                    { attributes: { type: 'Lead' }, Id: '00Q1' },
                    { attributes: { type: 'Contact' }, Id: '003A' },
                    { attributes: { type: 'Lead' }, Id: '00Q2' },
                ],
            });

            const res = await api.searchPeopleByEmail('ann@example.com');

            expect(captured).toHaveLength(1);
            const q = queryParam(captured[0].uri, 'q');
            expect(captured[0].method).toBe('GET');
            expect(q).toMatch(/^FIND \{ann@example\.com\} IN EMAIL FIELDS RETURNING /);
            expect(q).toMatch(/Lead\(Id,[^)]*Email[^)]*\)/);
            expect(q).toMatch(/Contact\(Id,[^)]*Email[^)]*\)/);
            expect(res.leads.map((r) => r.Id)).toEqual(['00Q1', '00Q2']);
            expect(res.contacts.map((r) => r.Id)).toEqual(['003A']);
        });

        it('escapes SOSL reserved characters so the term cannot break out of FIND {}', async () => {
            reply('GET', /\/search\?/, 200, { searchRecords: [] });

            const res = await api.searchPeopleByEmail('a+b"}OR{x@example.com');

            const q = queryParam(captured[0].uri, 'q');
            expect(q).toContain('FIND {a\\+b\\"\\}OR\\{x@example.com} IN EMAIL FIELDS');
            expect(res).toEqual({ leads: [], contacts: [] });
        });
    });

    describe('createContentVersion(title, pathOnClient, versionData, firstPublishLocationId)', () => {
        it('POSTs ContentVersion with base64 VersionData and FirstPublishLocationId', async () => {
            reply('POST', /\/sobjects\/ContentVersion$/, 201, { id: '068X', success: true, errors: [] });

            const b64 = Buffer.from('hello').toString('base64');
            const res = await api.createContentVersion('Report', 'report.txt', b64, '001ACC');

            expect(captured[0].method).toBe('POST');
            expect(captured[0].body).toEqual({
                Title: 'Report',
                PathOnClient: 'report.txt',
                VersionData: b64,
                FirstPublishLocationId: '001ACC',
            });
            expect(res).toEqual({ id: '068X', success: true, errors: [] });
        });

        it('base64-encodes a Buffer', async () => {
            reply('POST', /\/sobjects\/ContentVersion$/, 201, { id: '068Y', success: true });
            await api.createContentVersion('t', 'f.bin', Buffer.from([1, 2, 3]), '001ACC');
            expect(captured[0].body.VersionData).toBe('AQID');
        });
    });

    describe('createContentNote(title, content, linkedEntityId)', () => {
        it('creates the ContentNote (base64 HTML) then links it with a ContentDocumentLink', async () => {
            reply('POST', /\/sobjects\/ContentNote$/, 201, { id: '069N', success: true });
            reply('POST', /\/sobjects\/ContentDocumentLink$/, 201, { id: '06AL', success: true });

            const res = await api.createContentNote('Call', 'a < b\nline2', '001ACC');

            expect(captured).toHaveLength(2);
            expect(captured[0].uri).toMatch(/\/sobjects\/ContentNote$/);
            expect(captured[0].body.Title).toBe('Call');
            expect(Buffer.from(captured[0].body.Content, 'base64').toString()).toBe(
                'a &lt; b<br>line2'
            );
            expect(captured[1].uri).toMatch(/\/sobjects\/ContentDocumentLink$/);
            expect(captured[1].body).toEqual({
                ContentDocumentId: '069N',
                LinkedEntityId: '001ACC',
                ShareType: 'V',
            });
            expect(res).toEqual({ id: '069N', success: true, contentDocumentLinkId: '06AL' });
        });
    });

    describe('listUsers(activeOnly)', () => {
        const rows = { totalSize: 1, done: true, records: [{ Id: '005U' }] };

        it('queries User with IsActive = true when activeOnly', async () => {
            reply('GET', /\/query\?/, 200, rows);

            const res = await api.listUsers(true);

            const q = queryParam(captured[0].uri, 'q');
            expect(q).toMatch(/^SELECT .*Id.*Username.*Email.*IsActive.* FROM User WHERE IsActive = true/);
            expect(res).toEqual([{ Id: '005U' }]);
        });

        it('has no WHERE clause when activeOnly is not set', async () => {
            reply('GET', /\/query\?/, 200, rows);

            await api.listUsers();

            const q = queryParam(captured[0].uri, 'q');
            expect(q).toMatch(/ FROM User( LIMIT \d+)?$/);
            expect(q).not.toMatch(/WHERE/);
        });
    });
});
