const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'http://localhost/xero',
        scope: 'openid offline_access accounting.contacts',
        access_token: 'tok',
        tenantId: 'tenant-1',
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
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Xero Api', () => {
    describe('construction & auth', () => {
        it('sets Accounting baseUrl and OAuth endpoints', () => {
            const api = makeApi();
            expect(api.baseUrl).toBe('https://api.xero.com/api.xro/2.0');
            expect(api.tokenUri).toBe('https://identity.xero.com/connect/token');
            expect(api.authorizationUri).toContain(
                'https://login.xero.com/identity/connect/authorize'
            );
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.tenantId).toBe('tenant-1');
        });

        it('adds Bearer and xero-tenant-id headers', async () => {
            const api = makeApi({ access_token: 'secret', tenantId: 't-99' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toMatch(/Bearer secret/);
            expect(headers['xero-tenant-id']).toBe('t-99');
        });

        it('setTenant updates the header value', async () => {
            const api = makeApi({ tenantId: null });
            api.setTenant('new-tenant');
            const headers = await api.addAuthHeaders({});
            expect(headers['xero-tenant-id']).toBe('new-tenant');
        });

        it('throws when Accounting calls run without a tenant', async () => {
            const api = makeApi({ tenantId: null });
            await expect(api.getContacts()).rejects.toThrow(/xero-tenant-id/i);
        });
    });

    describe('Identity / Connections', () => {
        it('getConnections hits the Identity host (not Accounting baseUrl)', async () => {
            const api = makeApi();
            await api.getConnections({ authEventId: 'ae-1' });
            expect(api._captured[0].url).toBe(
                'https://api.xero.com/Connections?authEventId=ae-1'
            );
        });

        it('deleteConnection hits DELETE /Connections/{id}', async () => {
            const api = makeApi();
            await api.deleteConnection('conn-1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.xero.com/Connections/conn-1'
            );
        });

        it('getTenants aliases getConnections', async () => {
            const api = makeApi();
            await api.getTenants();
            expect(api._captured[0].url).toBe(
                'https://api.xero.com/Connections'
            );
        });
    });

    describe('Organisation', () => {
        it('getOrganisations hits GET /Organisation', async () => {
            const api = makeApi();
            await api.getOrganisations();
            expect(api._captured[0].url).toBe(
                'https://api.xero.com/api.xro/2.0/Organisation'
            );
        });

        it('getOrganisation returns the first org', async () => {
            const api = makeApi();
            api._get = async () => ({
                Organisations: [{ OrganisationID: 'o1', Name: 'Acme' }],
            });
            const org = await api.getOrganisation();
            expect(org.OrganisationID).toBe('o1');
        });
    });

    describe('Contacts', () => {
        it('getContacts hits GET /Contacts with query params', async () => {
            const api = makeApi();
            await api.getContacts({ page: 2, where: 'ContactStatus=="ACTIVE"' });
            const { url } = api._captured[0];
            expect(url).toContain(
                'https://api.xero.com/api.xro/2.0/Contacts?'
            );
            expect(url).toContain('page=2');
            expect(url).toContain('where=');
        });

        it('getContacts forwards If-Modified-Since', async () => {
            const api = makeApi();
            await api.getContacts({ ifModifiedSince: '2026-01-01T00:00:00' });
            expect(api._captured[0].headers['If-Modified-Since']).toBe(
                '2026-01-01T00:00:00'
            );
        });

        it('getContact hits GET /Contacts/{id}', async () => {
            const api = makeApi();
            await api.getContact('c-1');
            expect(api._captured[0].url).toBe(
                'https://api.xero.com/api.xro/2.0/Contacts/c-1'
            );
        });

        it('createContacts PUTs the body', async () => {
            const api = makeApi();
            const body = { Contacts: [{ Name: 'Jane' }] };
            await api.createContacts(body, { idempotencyKey: 'idem-1' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Idempotency-Key']).toBe('idem-1');
        });

        it('updateContact POSTs to /Contacts/{id}', async () => {
            const api = makeApi();
            const body = { Contacts: [{ Name: 'Jane Updated' }] };
            await api.updateContact('c-1', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.xero.com/api.xro/2.0/Contacts/c-1'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('Invoices', () => {
        it('getInvoices / getInvoice / createInvoices / updateInvoice', async () => {
            const api = makeApi();
            await api.getInvoices({ page: 1 });
            await api.getInvoice('inv-1');
            await api.createInvoices({ Invoices: [{ Type: 'ACCREC' }] });
            await api.updateInvoice('inv-1', {
                Invoices: [{ Status: 'AUTHORISED' }],
            });
            expect(api._captured[0].url).toContain('/Invoices?page=1');
            expect(api._captured[1].url).toContain('/Invoices/inv-1');
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[3].method).toBe('POST');
        });
    });

    describe('Accounts / Payments / Items', () => {
        it('covers chart of accounts CRUD surface', async () => {
            const api = makeApi();
            await api.getAccounts();
            await api.getAccount('a-1');
            await api.createAccount({ Code: '200', Name: 'Sales', Type: 'REVENUE' });
            await api.updateAccount('a-1', { Accounts: [{ Name: 'Sales 2' }] });
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'PUT',
                'POST',
            ]);
        });

        it('covers payments list/get/create', async () => {
            const api = makeApi();
            await api.getPayments();
            await api.getPayment('p-1');
            await api.createPayment({ Invoice: { InvoiceID: 'i' }, Amount: 10 });
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://api.xero.com/api.xro/2.0/Payments'
            );
        });

        it('covers items including delete', async () => {
            const api = makeApi();
            await api.getItems();
            await api.getItem('it-1');
            await api.createItems({ Items: [{ Code: 'SKU' }] });
            await api.updateItem('it-1', { Items: [{ Name: 'Widget' }] });
            await api.deleteItem('it-1');
            expect(api._captured[4].method).toBe('DELETE');
            expect(api._captured[4].url).toBe(
                'https://api.xero.com/api.xro/2.0/Items/it-1'
            );
        });
    });
});
