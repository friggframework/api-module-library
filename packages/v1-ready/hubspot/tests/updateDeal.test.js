/**
 * Api.updateDeal used to read this.URLs.getDealById, which does not exist (the key is dealById), so every call threw
 * a TypeError before any request was sent. Unit test: `_patch` is stubbed, so there is no network call.
 */
const { Api } = require('../api');

describe('Api.updateDeal', () => {
    it('PATCHes the deal by id with its properties', async () => {
        const api = new Api({});
        api._patch = jest.fn().mockResolvedValue({ id: '42' });
        await api.updateDeal({ dealId: '42', properties: { dealstage: 'closedwon' } });
        expect(api._patch).toHaveBeenCalledWith({
            url: 'https://api.hubapi.com/crm/v3/objects/deals/42',
            body: { properties: { dealstage: 'closedwon' } },
        });
    });
});
