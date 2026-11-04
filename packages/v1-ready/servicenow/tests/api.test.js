const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        instance: 'dev12345',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { result: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { result: { sys_id: 'abc' } };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { result: { sys_id: 'abc' } };
    };
    return api;
}

describe('ServiceNow Api', () => {
    describe('construction & auth', () => {
        it('uses the instance host template when unset (matches OpenAPI)', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe('https://{instance}.service-now.com');
            expect(api.tokenUri).toBe(
                'https://{instance}.service-now.com/oauth_token.do'
            );
        });

        it('setInstance rebuilds base and token URLs', () => {
            const api = new Api({});
            api.setInstance('acme');
            expect(api.baseUrl).toBe('https://acme.service-now.com');
            expect(api.tokenUri).toBe(
                'https://acme.service-now.com/oauth_token.do'
            );
            expect(api.getAuthorizationUri()).toContain(
                'https://acme.service-now.com/oauth_auth.do?'
            );
            expect(api.getAuthorizationUri()).toContain('response_type=code');
            expect(api.getAuthorizationUri()).toContain('client_id=');
        });

        it('omits scope from authorize URL when unset', () => {
            const api = new Api({ instance: 'acme', client_id: 'cid' });
            expect(api.getAuthorizationUri()).not.toContain('scope=');
        });

        it('includes scope when configured', () => {
            const api = new Api({
                instance: 'acme',
                client_id: 'cid',
                scope: 'useraccount',
            });
            expect(api.getAuthorizationUri()).toContain('scope=useraccount');
        });

        it('sends Bearer when access_token is set', async () => {
            const api = new Api({
                instance: 'acme',
                access_token: 'tok',
                username: 'u',
                password: 'p',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok');
        });

        it('falls back to Basic when no access_token', async () => {
            const api = new Api({
                instance: 'acme',
                username: 'alice',
                password: 'secret',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe(
                'Basic ' + Buffer.from('alice:secret').toString('base64')
            );
        });

        it('isAuthenticated for token or basic credentials', () => {
            expect(
                new Api({ access_token: 't', instance: 'x' }).isAuthenticated()
            ).toBe(true);
            expect(
                new Api({
                    username: 'u',
                    password: 'p',
                    instance: 'x',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({ instance: 'x' }).isAuthenticated()).toBe(false);
        });

        it('getTokenFromCode posts form-urlencoded without inventing scope', async () => {
            const api = new Api({
                instance: 'acme',
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app/redirect/servicenow',
            });
            let captured;
            api._post = async (options) => {
                captured = options;
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    expires_in: 1800,
                };
            };
            api.setTokens = async () => {};
            await api.getTokenFromCode('code-1');
            expect(captured.url).toBe(
                'https://acme.service-now.com/oauth_token.do'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('code=code-1');
            expect(body).not.toContain('scope=');
        });
    });

    describe('table reads', () => {
        it('listIncidents hits GET /api/now/table/incident', async () => {
            const api = makeApi();
            await api.listIncidents({ sysparm_limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://dev12345.service-now.com/api/now/table/incident'
            );
            expect(api._captured[0].query.sysparm_limit).toBe(10);
        });

        it('getIncident hits GET /api/now/table/incident/{sys_id}', async () => {
            const api = makeApi();
            await api.getIncident('sys1');
            expect(api._captured[0].url).toBe(
                'https://dev12345.service-now.com/api/now/table/incident/sys1'
            );
        });

        it('createIncident POSTs JSON body', async () => {
            const api = makeApi();
            await api.createIncident({ short_description: 'down' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({
                short_description: 'down',
            });
        });

        it('updateIncident PATCHes JSON body', async () => {
            const api = makeApi();
            await api.updateIncident('sys1', { state: '6' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toContain('/incident/sys1');
        });

        it('covers catalog, problem, change, user, company paths', async () => {
            const api = makeApi();
            await api.listScRequests();
            await api.getScRequest('r1');
            await api.listScReqItems();
            await api.getScReqItem('i1');
            await api.listProblems();
            await api.getProblem('p1');
            await api.listChangeRequests();
            await api.getChangeRequest('c1');
            await api.listSysUsers({ sysparm_limit: 1 });
            await api.getSysUser('u1');
            await api.listCompanies();
            await api.getCompany('co1');
            const urls = api._captured.map((c) => c.url);
            expect(urls).toEqual(
                expect.arrayContaining([
                    'https://dev12345.service-now.com/api/now/table/sc_request',
                    'https://dev12345.service-now.com/api/now/table/sc_request/r1',
                    'https://dev12345.service-now.com/api/now/table/sc_req_item',
                    'https://dev12345.service-now.com/api/now/table/sc_req_item/i1',
                    'https://dev12345.service-now.com/api/now/table/problem',
                    'https://dev12345.service-now.com/api/now/table/problem/p1',
                    'https://dev12345.service-now.com/api/now/table/change_request',
                    'https://dev12345.service-now.com/api/now/table/change_request/c1',
                    'https://dev12345.service-now.com/api/now/table/sys_user',
                    'https://dev12345.service-now.com/api/now/table/sys_user/u1',
                    'https://dev12345.service-now.com/api/now/table/core_company',
                    'https://dev12345.service-now.com/api/now/table/core_company/co1',
                ])
            );
        });

        it('uses sn_customerservice_case (not csm_case) for CSM cases', async () => {
            const api = makeApi();
            await api.listCases();
            await api.getCase('case1');
            await api.createCase({ short_description: 'help' });
            await api.updateCase('case1', { state: '3' });
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://dev12345.service-now.com/api/now/table/sn_customerservice_case',
                'https://dev12345.service-now.com/api/now/table/sn_customerservice_case/case1',
                'https://dev12345.service-now.com/api/now/table/sn_customerservice_case',
                'https://dev12345.service-now.com/api/now/table/sn_customerservice_case/case1',
            ]);
        });

        it('lists and gets attachment metadata', async () => {
            const api = makeApi();
            await api.listAttachments({
                sysparm_query: 'table_name=incident^table_sys_id=x',
            });
            await api.getAttachment('att1');
            expect(api._captured[0].url).toBe(
                'https://dev12345.service-now.com/api/now/attachment'
            );
            expect(api._captured[1].url).toBe(
                'https://dev12345.service-now.com/api/now/attachment/att1'
            );
        });

        it('omits null/undefined query params', async () => {
            const api = makeApi();
            await api.listIncidents({
                sysparm_query: undefined,
                sysparm_limit: null,
                sysparm_offset: 0,
            });
            expect(api._captured[0].query).toEqual({ sysparm_offset: 0 });
        });
    });
});
