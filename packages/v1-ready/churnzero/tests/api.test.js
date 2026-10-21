const { Api, DEFAULT_BASE_URL } = require('../api');

function makeApi(params = { username: 'user', api_key: 'key' }) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { value: [] };
    };
    api._get = record('GET');
    api._post = record('POST');
    return api;
}

describe('ChurnZero Api', () => {
    describe('auth', () => {
        it('maps username/api_key onto Basic auth username/password', () => {
            const api = new Api({ username: 'u', api_key: 'k' });
            expect(api.username).toBe('u');
            expect(api.api_key).toBe('k');
            expect(api.password).toBe('k');
        });

        it('builds the Base64(username:apiKey) Basic header', async () => {
            const api = new Api({ username: 'u', api_key: 'k' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe(
                'Basic ' + Buffer.from('u:k').toString('base64')
            );
        });

        it('defaults to the published OpenAPI sample base URL', () => {
            const api = new Api({ username: 'u', api_key: 'k' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.base_url).toBe(DEFAULT_BASE_URL);
        });

        it('honors a tenant-specific base_url and strips trailing slash', () => {
            const api = new Api({
                username: 'u',
                api_key: 'k',
                base_url: 'https://acme.us1app.churnzero.net/public/v1/',
            });
            expect(api.baseUrl).toBe(
                'https://acme.us1app.churnzero.net/public/v1'
            );
        });

        it('exposes a basic authorization form', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('basic');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining(['username', 'api_key', 'base_url'])
            );
        });
    });

    describe('OData helpers', () => {
        it('escapes single quotes in OData string keys', () => {
            const api = new Api({ username: 'u', api_key: 'k' });
            expect(api._odataString("O'Brien")).toBe("O''Brien");
        });

        it('maps filter/top aliases onto $filter/$top query keys', async () => {
            const api = makeApi();
            await api.listAccounts({ filter: "IsActive eq true", top: 5 });
            expect(api.sent[0].query).toEqual({
                $filter: 'IsActive eq true',
                $top: 5,
            });
        });
    });

    describe('accounts', () => {
        it('listAccounts GETs /Account', async () => {
            const api = makeApi();
            await api.listAccounts();
            expect(api.sent[0].url).toBe(`${DEFAULT_BASE_URL}/Account`);
        });

        it('getAccount GETs /Account({Id})', async () => {
            const api = makeApi();
            await api.getAccount(42);
            expect(api.sent[0].url).toBe(`${DEFAULT_BASE_URL}/Account(42)`);
        });

        it('getAccountByExternalId uses OData external-id key', async () => {
            const api = makeApi();
            await api.getAccountByExternalId('ext-1');
            expect(api.sent[0].url).toBe(
                `${DEFAULT_BASE_URL}/Account(AccountExternalId='ext-1')`
            );
        });

        it('getAccountPrimaryChurnScore navigates PrimaryChurnScore', async () => {
            const api = makeApi();
            await api.getAccountPrimaryChurnScore(9);
            expect(api.sent[0].url).toBe(
                `${DEFAULT_BASE_URL}/Account(9)/PrimaryChurnScore`
            );
        });
    });

    describe('contacts', () => {
        it('listContacts GETs /Contact', async () => {
            const api = makeApi();
            await api.listContacts();
            expect(api.sent[0].url).toBe(`${DEFAULT_BASE_URL}/Contact`);
        });

        it('getContactByExternalId uses compound OData key', async () => {
            const api = makeApi();
            await api.getContactByExternalId('acc', "c't");
            expect(api.sent[0].url).toBe(
                `${DEFAULT_BASE_URL}/Contact(AccountExternalId='acc',ContactExternalId='c''t')`
            );
        });
    });

    describe('scores / tasks / activity', () => {
        it('hits churn score and calculation collections', async () => {
            const api = makeApi();
            await api.listChurnScores();
            await api.getChurnScoreCalculation(3);
            expect(api.sent[0].url).toBe(`${DEFAULT_BASE_URL}/ChurnScore`);
            expect(api.sent[1].url).toBe(
                `${DEFAULT_BASE_URL}/ChurnScoreCalculation(3)`
            );
        });

        it('hits task and timeline-adjacent collections', async () => {
            const api = makeApi();
            await api.listTasks();
            await api.listEvents();
            await api.listNotes();
            await api.listMeetings();
            await api.listMessages();
            expect(api.sent.map((s) => s.url)).toEqual([
                `${DEFAULT_BASE_URL}/Task`,
                `${DEFAULT_BASE_URL}/Event`,
                `${DEFAULT_BASE_URL}/Note`,
                `${DEFAULT_BASE_URL}/Meeting`,
                `${DEFAULT_BASE_URL}/Message`,
            ]);
        });
    });

    describe('testAuth', () => {
        it('lists a single UserAccount page', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].url).toBe(`${DEFAULT_BASE_URL}/UserAccount`);
            expect(api.sent[0].query).toEqual({ $top: 1 });
        });
    });
});
