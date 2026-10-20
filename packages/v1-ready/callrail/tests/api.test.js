const { Api } = require('../api');

// Fully offline: stub the low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { accounts: [], page: 1 };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'updated' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return undefined;
    };
    return api;
}

describe('CallRail Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.callrail.com/v3');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('abc');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
        });

        it('formats Authorization as Token token="..."', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Token token="secret"');
        });

        it('adds Request-From when configured', async () => {
            const api = new Api({
                api_key: 'secret',
                request_from: 'lefthook',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers['Request-From']).toBe('lefthook');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('accounts', () => {
        it('listAccounts hits GET /a.json', async () => {
            const api = makeApi();
            await api.listAccounts();
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a.json'
            );
        });

        it('getAccount hits GET /a/{account_id}.json', async () => {
            const api = makeApi();
            await api.getAccount('ACC1');
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1.json'
            );
        });
    });

    describe('companies', () => {
        it('listCompanies hits the companies path', async () => {
            const api = makeApi();
            await api.listCompanies('ACC1', { page: 2 });
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/companies.json'
            );
            expect(api._captured[0].query).toEqual({ page: 2 });
        });

        it('getCompany / createCompany / updateCompany use the right verbs', async () => {
            const api = makeApi();
            await api.getCompany('ACC1', 'COM1');
            await api.createCompany('ACC1', { name: 'Widget Shop' });
            await api.updateCompany('ACC1', 'COM1', { name: 'Updated' });
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/companies/COM1.json'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body).toEqual({ name: 'Widget Shop' });
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].body).toEqual({ name: 'Updated' });
        });
    });

    describe('calls', () => {
        it('listCalls / getCall / createCall / updateCall', async () => {
            const api = makeApi();
            await api.listCalls('ACC1', { direction: 'inbound' });
            await api.getCall('ACC1', 'CAL1');
            await api.createCall('ACC1', {
                caller_id: '+1',
                customer_phone_number: '+2',
                business_phone_number: '+3',
            });
            await api.updateCall('ACC1', 'CAL1', { note: 'hi' });
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/calls.json'
            );
            expect(api._captured[1].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/calls/CAL1.json'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('form submissions', () => {
        it('list / create / update form submissions', async () => {
            const api = makeApi();
            await api.listFormSubmissions('ACC1');
            await api.createFormSubmission('ACC1', {
                form_submission: { company_id: 'COM1', form_data: {} },
            });
            await api.updateFormSubmission('ACC1', 'FOR1', {
                lead_status: 'good_lead',
            });
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/form_submissions.json'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/form_submissions/FOR1.json'
            );
        });
    });

    describe('text messages', () => {
        it('list / get / send text conversations', async () => {
            const api = makeApi();
            await api.listTextConversations('ACC1');
            await api.getTextConversation('ACC1', 'KZaGR');
            await api.sendTextMessage('ACC1', {
                company_id: 'COM1',
                customer_phone_number: '+14044442233',
                tracking_number: '+17703334455',
                content: 'Hello',
            });
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/text-messages.json'
            );
            expect(api._captured[1].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/text-messages/KZaGR.json'
            );
            expect(api._captured[2].method).toBe('POST');
        });
    });

    describe('trackers & users', () => {
        it('listTrackers / getTracker / listUsers / getUser', async () => {
            const api = makeApi();
            await api.listTrackers('ACC1');
            await api.getTracker('ACC1', 'TRK1');
            await api.listUsers('ACC1');
            await api.getUser('ACC1', 'USR1');
            expect(api._captured[0].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/trackers.json'
            );
            expect(api._captured[1].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/trackers/TRK1.json'
            );
            expect(api._captured[2].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/users.json'
            );
            expect(api._captured[3].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/users/USR1.json'
            );
        });
    });

    describe('integrations (webhooks)', () => {
        it('CRUD integrations', async () => {
            const api = makeApi();
            await api.listIntegrations('ACC1', { company_id: 'COM1' });
            await api.getIntegration('ACC1', '4', { fields: 'signing_key' });
            await api.createIntegration('ACC1', {
                type: 'Webhooks',
                company_id: 'COM1',
                config: {
                    post_call_webhook: ['https://hook.example.com'],
                },
            });
            await api.updateIntegration('ACC1', '4', { state: 'active' });
            await api.deleteIntegration('ACC1', '4');
            expect(api._captured[0].query).toEqual({ company_id: 'COM1' });
            expect(api._captured[1].url).toBe(
                'https://api.callrail.com/v3/a/ACC1/integrations/4.json'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].body.type).toBe('Webhooks');
            expect(api._captured[3].method).toBe('PUT');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });
});
