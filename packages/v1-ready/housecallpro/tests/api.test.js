const crypto = require('crypto');
const { Api, DEFAULT_SCOPE } = require('../api');
const {
    verifyHousecallProSignature,
    verifyWebhookSignature,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
} = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/housecallpro',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return {};
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    return api;
}

describe('Housecall Pro Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL, token URI, and authorize URL', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/housecallpro',
            });
            expect(api.baseUrl).toBe('https://api.housecallpro.com');
            expect(api.tokenUri).toBe(
                'https://api.housecallpro.com/oauth/token'
            );
            expect(api.scope).toBe(DEFAULT_SCOPE);
            expect(api.authorizationUri).toContain(
                'pro.housecallpro.com/oauth/authorize'
            );
            expect(api.authorizationUri).toContain('response_type=code');
            expect(api.authorizationUri).toContain('client_id=c');
            expect(api.authorizationUri).toContain('scope=public');
        });

        it('accepts an access_token from params', () => {
            const api = new Api({ access_token: 'tok' });
            expect(api.access_token).toBe('tok');
        });

        it('adds Bearer auth headers', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('adds X-Company-Id when companyId is set', async () => {
            const api = new Api({
                access_token: 'secret',
                companyId: 'loc-1',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Company-Id']).toBe('loc-1');
        });

        it('getTokenFromCode POSTs JSON to the token URI', async () => {
            const api = makeApi({ access_token: 'stale' });
            api.setTokens = async () => {};
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    expires_in: 3600,
                };
            };
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.housecallpro.com/oauth/token'
            );
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body).toEqual({
                client_id: 'cid',
                client_secret: 'csecret',
                grant_type: 'authorization_code',
                code: 'auth-code',
                redirect_uri:
                    'https://app.example.com/redirect/housecallpro',
            });
            expect(api.access_token).toBeUndefined();
        });
    });

    describe('company', () => {
        it('getCompany hits GET /company', async () => {
            const api = makeApi();
            await api.getCompany();
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/company'
            );
        });
    });

    describe('customers', () => {
        it('listCustomers hits GET /customers with query params', async () => {
            const api = makeApi();
            await api.listCustomers({ page: 2, q: 'jane' });
            const { url } = api._captured[0];
            expect(url).toContain('https://api.housecallpro.com/customers?');
            expect(url).toContain('page=2');
            expect(url).toContain('q=jane');
        });

        it('getCustomer hits GET /customers/{id}', async () => {
            const api = makeApi();
            await api.getCustomer('cust-1');
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/customers/cust-1'
            );
        });

        it('createCustomer POSTs JSON to /customers', async () => {
            const api = makeApi();
            const body = { first_name: 'Jane', last_name: 'Doe' };
            await api.createCustomer(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.housecallpro.com/customers'
            );
            expect(captured.body).toEqual(body);
        });

        it('updateCustomer PUTs JSON to /customers/{id}', async () => {
            const api = makeApi();
            await api.updateCustomer('cust-1', { email: 'a@b.com' });
            const captured = api._captured[0];
            expect(captured.method).toBe('PUT');
            expect(captured.url).toBe(
                'https://api.housecallpro.com/customers/cust-1'
            );
            expect(captured.body).toEqual({ email: 'a@b.com' });
        });
    });

    describe('jobs', () => {
        it('listJobs hits GET /jobs', async () => {
            const api = makeApi();
            await api.listJobs({ customer_id: 'c1' });
            expect(api._captured[0].url).toContain(
                'https://api.housecallpro.com/jobs?'
            );
            expect(api._captured[0].url).toContain('customer_id=c1');
        });

        it('getJob hits GET /jobs/{id}', async () => {
            const api = makeApi();
            await api.getJob('job-1');
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/jobs/job-1'
            );
        });

        it('createJob POSTs to /jobs', async () => {
            const api = makeApi();
            await api.createJob({ customer_id: 'c1' });
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/jobs'
            );
        });

        it('updateJobSchedule PUTs to /jobs/{id}/schedule', async () => {
            const api = makeApi();
            await api.updateJobSchedule('job-1', {
                scheduled_start: '2026-01-01T10:00:00Z',
            });
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/jobs/job-1/schedule'
            );
        });
    });

    describe('employees / estimates / invoices / leads', () => {
        it('listEmployees hits GET /employees', async () => {
            const api = makeApi();
            await api.listEmployees();
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/employees'
            );
        });

        it('getEmployee hits GET /employees/{id}', async () => {
            const api = makeApi();
            await api.getEmployee('e1');
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/employees/e1'
            );
        });

        it('listEstimates / getEstimate / createEstimate', async () => {
            const api = makeApi();
            await api.listEstimates();
            await api.getEstimate('est-1');
            await api.createEstimate({ customer_id: 'c1' });
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/estimates'
            );
            expect(api._captured[1].url).toBe(
                'https://api.housecallpro.com/estimates/est-1'
            );
            expect(api._captured[2].method).toBe('POST');
        });

        it('listInvoices / getInvoice', async () => {
            const api = makeApi();
            await api.listInvoices();
            await api.getInvoice('inv-1');
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/invoices'
            );
            expect(api._captured[1].url).toBe(
                'https://api.housecallpro.com/invoices/inv-1'
            );
        });

        it('listLeads / getLead / createLead', async () => {
            const api = makeApi();
            await api.listLeads();
            await api.getLead('lead-1');
            await api.createLead({ customer_id: 'c1' });
            expect(api._captured[0].url).toBe(
                'https://api.housecallpro.com/leads'
            );
            expect(api._captured[1].url).toBe(
                'https://api.housecallpro.com/leads/lead-1'
            );
            expect(api._captured[2].method).toBe('POST');
        });
    });

    describe('webhook signature verification', () => {
        it('accepts a valid Api-Signature / Api-Timestamp HMAC', () => {
            const secret = 'whsec_test';
            const body = '{"event":"job.created","company_id":"c1"}';
            const timestamp = '1710000000';
            const signature = crypto
                .createHmac('sha256', secret)
                .update(`${timestamp}.${body}`, 'utf8')
                .digest('hex');
            const result = verifyHousecallProSignature({
                req: {
                    headers: {
                        [TIMESTAMP_HEADER]: timestamp,
                        [SIGNATURE_HEADER]: signature,
                    },
                    rawBody: body,
                },
                signingSecret: secret,
            });
            expect(result.valid).toBe(true);
            expect(
                verifyWebhookSignature(body, signature, secret, timestamp)
            ).toBe(true);
        });

        it('rejects a bad signature', () => {
            const result = verifyHousecallProSignature({
                req: {
                    headers: {
                        [TIMESTAMP_HEADER]: '1',
                        [SIGNATURE_HEADER]: 'deadbeef',
                    },
                    rawBody: '{}',
                },
                signingSecret: 'secret',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/mismatch/i);
        });
    });
});
