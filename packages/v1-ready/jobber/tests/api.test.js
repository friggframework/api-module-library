const crypto = require('crypto');
const { Api, DEFAULT_GRAPHQL_VERSION } = require('../api');
const {
    verifyJobberSignature,
    verifyWebhookSignature,
    SIGNATURE_HEADER,
} = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/jobber',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: {} };
    };
    return api;
}

describe('Jobber Api', () => {
    describe('construction & auth', () => {
        it('sets the GraphQL base URL and default API version', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/jobber',
            });
            expect(api.baseUrl).toBe('https://api.getjobber.com/api/graphql');
            expect(api.tokenUri).toBe(
                'https://api.getjobber.com/api/oauth/token'
            );
            expect(api.graphqlVersion).toBe(DEFAULT_GRAPHQL_VERSION);
            expect(api.authorizationUri).toContain(
                'api.getjobber.com/api/oauth/authorize'
            );
            expect(api.authorizationUri).toContain('response_type=code');
            expect(api.authorizationUri).toContain('client_id=c');
        });

        it('accepts an access_token from params', () => {
            const api = new Api({ access_token: 'tok' });
            expect(api.access_token).toBe('tok');
        });
    });

    describe('graphql transport', () => {
        it('POSTs to the GraphQL endpoint with version + JSON body', async () => {
            const api = makeApi();
            await api.graphql('query { account { id } }', {});
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.getjobber.com/api/graphql'
            );
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.headers['X-JOBBER-GRAPHQL-VERSION']).toBe(
                DEFAULT_GRAPHQL_VERSION
            );
            expect(captured.body).toEqual({
                query: 'query { account { id } }',
                variables: {},
            });
        });

        it('throws when the response carries GraphQL errors', async () => {
            const api = makeApi();
            api._post = async () => ({
                errors: [{ message: 'Throttled' }],
            });
            await expect(api.graphql('query { account { id } }')).rejects.toThrow(
                /Jobber GraphQL error: Throttled/
            );
        });
    });

    describe('account', () => {
        it('getAccount queries account { id name }', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return { data: { account: { id: 'MQ==', name: 'Acme' } } };
            };
            const account = await api.getAccount();
            expect(account).toEqual({ id: 'MQ==', name: 'Acme' });
            expect(api._captured[0].body.query).toMatch(/account/);
        });
    });

    describe('clients', () => {
        it('listClients sends first/after variables', async () => {
            const api = makeApi();
            await api.listClients({ first: 10, after: 'cursor1' });
            expect(api._captured[0].body.variables).toEqual({
                first: 10,
                after: 'cursor1',
            });
            expect(api._captured[0].body.query).toMatch(/clients\(/);
        });

        it('defaults listClients first to 25', async () => {
            const api = makeApi();
            await api.listClients();
            expect(api._captured[0].body.variables.first).toBe(25);
        });

        it('getClient queries by EncodedId', async () => {
            const api = makeApi();
            await api.getClient('client-id');
            expect(api._captured[0].body.variables).toEqual({ id: 'client-id' });
            expect(api._captured[0].body.query).toMatch(/client\(id:/);
        });

        it('createClient posts ClientCreateInput', async () => {
            const api = makeApi();
            const input = {
                firstName: 'Jane',
                lastName: 'Doe',
                emails: [
                    {
                        description: 'MAIN',
                        primary: true,
                        address: 'jane@example.com',
                    },
                ],
            };
            await api.createClient(input);
            expect(api._captured[0].body.variables.input).toEqual(input);
            expect(api._captured[0].body.query).toMatch(/clientCreate/);
        });

        it('editClient posts clientId + input', async () => {
            const api = makeApi();
            await api.editClient('cid', { firstName: 'Augusta' });
            expect(api._captured[0].body.variables).toEqual({
                clientId: 'cid',
                input: { firstName: 'Augusta' },
            });
        });
    });

    describe('jobs', () => {
        it('listJobs and getJob hit the jobs / job queries', async () => {
            const api = makeApi();
            await api.listJobs({ first: 10 });
            expect(api._captured[0].body.query).toMatch(/jobs\(/);
            await api.getJob('jid');
            expect(api._captured[1].body.query).toMatch(/job\(id:/);
            expect(api._captured[1].body.variables.id).toBe('jid');
        });

        it('createJob and editJob send mutations', async () => {
            const api = makeApi();
            await api.createJob({ title: 'Mow lawn', propertyId: 'pid' });
            expect(api._captured[0].body.query).toMatch(/jobCreate/);
            await api.editJob('jid', { title: 'Updated' });
            expect(api._captured[1].body.query).toMatch(/jobEdit/);
            expect(api._captured[1].body.variables.jobId).toBe('jid');
        });
    });

    describe('quotes', () => {
        it('listQuotes / getQuote / createQuote / editQuote', async () => {
            const api = makeApi();
            await api.listQuotes();
            expect(api._captured[0].body.query).toMatch(/quotes\(/);
            await api.getQuote('qid');
            expect(api._captured[1].body.query).toMatch(/quote\(id:/);
            await api.createQuote({ title: 'Quote', clientId: 'cid' });
            expect(api._captured[2].body.query).toMatch(/quoteCreate/);
            await api.editQuote('qid', { title: 'Revised' });
            expect(api._captured[3].body.query).toMatch(/quoteEdit/);
        });
    });

    describe('invoices', () => {
        it('listInvoices / getInvoice / editInvoice', async () => {
            const api = makeApi();
            await api.listInvoices({ first: 5 });
            expect(api._captured[0].body.query).toMatch(/invoices\(/);
            await api.getInvoice('iid');
            expect(api._captured[1].body.query).toMatch(/invoice\(id:/);
            await api.editInvoice('iid', { subject: 'Updated' });
            expect(api._captured[2].body.query).toMatch(/invoiceEdit/);
        });
    });

    describe('appDisconnect', () => {
        it('runs the appDisconnect mutation', async () => {
            const api = makeApi();
            await api.appDisconnect();
            expect(api._captured[0].body.query).toMatch(/appDisconnect/);
        });
    });
});

describe('Jobber webhook signature', () => {
    const secret = 'my app\'s OAuth client secret';
    const body =
        '{"data":{"webHookEvent":{"topic":"APP_CONNECT","appId":"id","accountId":"id","itemId":"id","occurredAt":"ISO8601DateTime"}}}';

    it('accepts a valid X-Jobber-Hmac-SHA256 header', () => {
        const digest = crypto
            .createHmac('sha256', secret)
            .update(body, 'utf8')
            .digest('base64');
        const result = verifyJobberSignature({
            req: {
                headers: { [SIGNATURE_HEADER]: digest },
                rawBody: body,
            },
            clientSecret: secret,
        });
        expect(result).toEqual({ valid: true });
        expect(verifyWebhookSignature(body, digest, secret)).toBe(true);
    });

    it('rejects a bad signature', () => {
        const result = verifyJobberSignature({
            req: {
                headers: { [SIGNATURE_HEADER]: 'not-valid' },
                rawBody: body,
            },
            clientSecret: secret,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch|malformed|length/i);
    });

    it('rejects missing signature header', () => {
        const result = verifyJobberSignature({
            req: { headers: {}, rawBody: body },
            clientSecret: secret,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/missing/);
    });
});
