const nock = require('nock');
const { Api } = require('../api');

describe('Slack listUsers', () => {
    afterEach(() => nock.cleanAll());

    it('GETs /users.list with cursor, limit, include_locale and team_id', async () => {
        const scope = nock('https://slack.com')
            .get('/api/users.list')
            .query({ limit: '200', cursor: 'dXNlcjpVMA==', include_locale: 'true', team_id: 'T1' })
            .reply(200, { ok: true, members: [{ id: 'U1' }], response_metadata: { next_cursor: '' } });
        const res = await new Api({ access_token: 'xoxb-t' }).listUsers({
            limit: 200,
            cursor: 'dXNlcjpVMA==',
            include_locale: true,
            team_id: 'T1',
        });
        expect(scope.isDone()).toBe(true);
        expect(res.members[0].id).toBe('U1');
    });

    it('sends no query when called without arguments', async () => {
        const scope = nock('https://slack.com').get('/api/users.list').reply(200, { ok: true, members: [] });
        await new Api({ access_token: 'xoxb-t' }).listUsers();
        expect(scope.isDone()).toBe(true);
    });
});
