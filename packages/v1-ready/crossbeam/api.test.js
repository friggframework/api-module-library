const { Api } = require('./api.js');

describe('Api', () => {
    let api;
    const params = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        organization_id: 'test_organization_id',
    };

    beforeEach(() => {
        api = new Api(params);
    });

    test('constructor sets the correct properties', () => {
        expect(api.baseUrl).toBe('https://api.crossbeam.com');
        expect(api.audience).toBe('https://api.getcrossbeam.com');
        expect(api.client_id).toBe(process.env.CROSSBEAM_CLIENT_ID);
        expect(api.client_secret).toBe(process.env.CROSSBEAM_CLIENT_SECRET);
        expect(api.redirect_uri).toBe(`${process.env.REDIRECT_URI}/crossbeam`);
        expect(api.scopes).toBe(process.env.CROSSBEAM_SCOPES);
        expect(api.access_token).toBe('test_access_token');
        expect(api.refresh_token).toBe('test_refresh_token');
        expect(api.organization_id).toBe('test_organization_id');
    });

    test('getTokenFromCode calls getTokenFromCodeBasicAuthHeader', async () => {
        api.getTokenFromCodeBasicAuthHeader = jest.fn();
        const code = 'test_code';
        await api.getTokenFromCode(code);
        expect(api.getTokenFromCodeBasicAuthHeader).toHaveBeenCalledWith(code);
    });

    test('setOrganizationId sets the organization_id property', () => {
        const newOrgId = 'new_organization_id';
        api.setOrganizationId(newOrgId);
        expect(api.organization_id).toBe(newOrgId);
    });

    test('addAuthHeaders adds the correct headers', async () => {
        const headers = {};
        const newHeaders = await api.addAuthHeaders(headers);
        expect(newHeaders.Authorization).toBe(`Bearer test_access_token`);
        expect(newHeaders['Xbeam-Organization']).toBe('test_organization_id');
    });

    test('getUserDetails calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const result = await api.getUserDetails();
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/users/me',
        });
        expect(result).toBe(response);
    });

    test('getPartnerPopulations calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const query = { key: 'value' };
        const result = await api.getPartnerPopulations(query);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/partner-populations',
            query,
        });
        expect(result).toBe(response);
    });

    test('getPartners calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const query = { key: 'value' };
        const result = await api.getPartners(query);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/partners',
            query,
        });
        expect(result).toBe(response);
    });

    test('getPartnerRecords calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const query = { key: 'value' };
        const result = await api.getPartnerRecords(query);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/partner-records',
            query,
        });
        expect(result).toBe(response);
    });

    test('getPopulations calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const query = { key: 'value' };
        const result = await api.getPopulations(query);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/populations',
            query,
        });
        expect(result).toBe(response);
    });

    test('getReports calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const query = { key: 'value' };
        const result = await api.getReports(query);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.2/reports',
            query,
        });
        expect(result).toBe(response);
    });

    test('getReportData calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const report_id = 'report_id';
        const query = { key: 'value' };
        const result = await api.getReportData(report_id, query);
        expect(api._get).toHaveBeenCalledWith({
            url: `https://api.crossbeam.com/v0.1/reports/${report_id}/data`,
            query,
        });
        expect(result).toBe(response);
    });

    test('search calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const search_term = 'search_term';
        const result = await api.search(search_term);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/search',
            query: {
                search: search_term,
            },
        });
        expect(result).toBe(response);
    });

    test('getThreads calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const query = { key: 'value' };
        const result = await api.getThreads(query);
        expect(api._get).toHaveBeenCalledWith({
            url: 'https://api.crossbeam.com/v0.1/threads',
            query,
        });
        expect(result).toBe(response);
    });

    test('getThreadTimelines calls _get with the correct options', async () => {
        const response = { data: 'test' };
        api._get = jest.fn().mockResolvedValue(response);
        const thread_id = 'thread_id';
        const query = { key: 'value' };
        const result = await api.getThreadTimelines(thread_id, query);
        expect(api._get).toHaveBeenCalledWith({
            url: `https://api.crossbeam.com/v0.1/threads/${thread_id}/timeline`,
            query,
        });
        expect(result).toBe(response);
    });
});
