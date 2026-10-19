const nock = require('nock');
const { Api } = require('../api');

describe('Fathom deleteWebhook', () => {
    afterEach(() => nock.cleanAll());

    it('sends DELETE /webhooks/{id} with no body', async () => {
        let body;
        const scope = nock('https://api.fathom.ai')
            .delete('/external/v1/webhooks/wh_123', (b) => {
                body = b;
                return true;
            })
            .reply(204);
        await new Api({ api_key: 'test-key' }).deleteWebhook('wh_123');
        expect(scope.isDone()).toBe(true);
        expect(body === undefined || body === '' || body === null).toBe(true);
    });

    it('surfaces a 404 for an unknown webhook', async () => {
        nock('https://api.fathom.ai').delete('/external/v1/webhooks/nope').reply(404, { error: 'not found' });
        await expect(new Api({ api_key: 'k' }).deleteWebhook('nope')).rejects.toBeTruthy();
    });
});
