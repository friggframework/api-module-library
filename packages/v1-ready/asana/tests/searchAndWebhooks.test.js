const nock = require('nock');
const { Api } = require('../api');

const BASE = 'https://app.asana.com';
const makeApi = () => new Api({ access_token: 'tok' });

describe('Asana searchTasksInWorkspace / createWebhook / deleteWebhook', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    it('searchTasksInWorkspace GETs /workspaces/{gid}/tasks/search with dotted filters', async () => {
        // nock expands dotted query keys into nested objects, so capture the raw URL instead.
        let seenUri;
        const scope = nock(BASE)
            .get(/\/api\/1\.0\/workspaces\/W1\/tasks\/search/)
            .query(true)
            .reply(200, function (uri) {
                seenUri = uri;
                return { data: [{ gid: 't1' }] };
            });
        const res = await makeApi().searchTasksInWorkspace('W1', {
            due_on: '2026-10-19',
            completed: false,
            projects_any: ['P1', 'P2'],
            'assignee.any': 'me',
            due_on_before: '2026-11-01',
            limit: 25,
            ignored: undefined,
        });
        expect(scope.isDone()).toBe(true);
        const u = new URL(seenUri, BASE);
        expect(u.pathname).toBe('/api/1.0/workspaces/W1/tasks/search');
        expect(Object.fromEntries(u.searchParams)).toEqual({
            due_on: '2026-10-19',
            completed: 'false',
            'projects.any': 'P1,P2',
            'assignee.any': 'me',
            'due_on.before': '2026-11-01',
            limit: '25',
        });
        expect(res.data[0].gid).toBe('t1');
    });

    it('createWebhook POSTs {data:{resource,target,filters}} to /webhooks', async () => {
        const filters = [{ resource_type: 'task', action: 'changed', fields: ['due_on'] }];
        const scope = nock(BASE)
            .post('/api/1.0/webhooks', {
                data: { resource: 'R1', target: 'https://x.test/hook', filters },
            })
            .reply(201, { data: { gid: 'wh1' } });
        const res = await makeApi().createWebhook('R1', 'https://x.test/hook', filters);
        expect(scope.isDone()).toBe(true);
        expect(res.data.gid).toBe('wh1');
    });

    it('createWebhook omits filters when not given', async () => {
        const scope = nock(BASE)
            .post('/api/1.0/webhooks', (b) => JSON.stringify(b) === JSON.stringify({ data: { resource: 'R1', target: 'https://x.test/h' } }))
            .reply(201, { data: {} });
        await makeApi().createWebhook('R1', 'https://x.test/h');
        expect(scope.isDone()).toBe(true);
    });

    it('deleteWebhook sends DELETE /webhooks/{gid}', async () => {
        const scope = nock(BASE).delete('/api/1.0/webhooks/wh1').reply(200, { data: {} });
        await makeApi().deleteWebhook('wh1');
        expect(scope.isDone()).toBe(true);
    });
});
