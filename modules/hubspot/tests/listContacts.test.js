/**
 * Unit tests for Api.listContacts pagination query-building.
 *
 * The module's other tests (api.test.js) are live-OAuth integration tests that
 * require real HubSpot credentials. These are fast unit tests that stub the
 * underlying `_get` so we can assert the request query without a network call.
 */
const { Api } = require('../api');

describe('Api.listContacts pagination', () => {
    function makeApi() {
        const api = new Api({});
        api._get = jest.fn().mockResolvedValue({ results: [], paging: {} });
        return api;
    }

    it('omits `after` from the query on the first page (no cursor)', async () => {
        const api = makeApi();
        await api.listContacts({ limit: 100, properties: ['email'] });

        expect(api._get).toHaveBeenCalledTimes(1);
        const { query } = api._get.mock.calls[0][0];
        // HubSpot 400s on `after=null`; the first page must not send it at all.
        expect(query).not.toHaveProperty('after');
        expect(query.limit).toBe(100);
        expect(query.properties).toEqual(['email']);
    });

    it('sends `after` from the second page onward', async () => {
        const api = makeApi();
        await api.listContacts({
            after: '12345',
            limit: 100,
            properties: ['email'],
        });

        expect(api._get.mock.calls[0][0].query.after).toBe('12345');
    });

    it('treats null `after` as "no cursor"', async () => {
        const api = makeApi();
        await api.listContacts({
            after: null,
            limit: 100,
            properties: ['email'],
        });

        expect(api._get.mock.calls[0][0].query).not.toHaveProperty('after');
    });
});
