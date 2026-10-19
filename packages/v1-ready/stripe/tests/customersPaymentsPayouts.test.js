const mockStripe = {
    oauth: { authorizeUrl: jest.fn() },
    customers: {
        retrieve: jest.fn(),
        list: jest.fn(),
        search: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    paymentIntents: { retrieve: jest.fn() },
    refunds: { retrieve: jest.fn() },
    payouts: { list: jest.fn() },
};
jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe));
const { Api } = require('../api');

describe('Stripe customers, payment intents, refunds, payouts (outbound request)', () => {
    let api;
    beforeEach(() => {
        jest.clearAllMocks();
        api = new Api({ stripeApiSecretKey: 'sk_test', stripeClientId: 'ca_x', redirect_uri: 'https://x.test/cb' });
    });

    it('retrieveCustomer sends the id and returns the SDK result', async () => {
        mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_1' });
        expect(await api.retrieveCustomer('cus_1')).toEqual({ id: 'cus_1' });
        expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_1', {}, {});
    });
    it('retrieveCustomer forwards expand and refuses a missing id', async () => {
        await api.retrieveCustomer('cus_1', { expand: ['subscriptions'] });
        expect(mockStripe.customers.retrieve).toHaveBeenCalledWith('cus_1', { expand: ['subscriptions'] }, {});
        await expect(api.retrieveCustomer()).rejects.toThrow('id is required');
        expect(mockStripe.customers.retrieve).toHaveBeenCalledTimes(1);
    });

    it('listCustomers passes list params and maps created_gte to created.gte', async () => {
        mockStripe.customers.list.mockResolvedValue({ data: [] });
        await api.listCustomers({ limit: 5, starting_after: 'cus_9', created_gte: 1700000000 });
        expect(mockStripe.customers.list).toHaveBeenCalledWith(
            { limit: 5, starting_after: 'cus_9', created: { gte: 1700000000 } },
            {}
        );
    });
    it('listCustomers with no params sends an empty query', async () => {
        await api.listCustomers();
        expect(mockStripe.customers.list).toHaveBeenCalledWith({}, {});
    });

    it('searchCustomers sends query merged with limit/page', async () => {
        await api.searchCustomers("email:'a@b.com'", { limit: 3, page: 'pg' });
        expect(mockStripe.customers.search).toHaveBeenCalledWith(
            { limit: 3, page: 'pg', query: "email:'a@b.com'" },
            {}
        );
        await expect(api.searchCustomers('')).rejects.toThrow('query is required');
    });

    it('createCustomer sends the params and idempotency options', async () => {
        await api.createCustomer({ email: 'a@b.com', name: 'A' }, { idempotencyKey: 'k1' });
        expect(mockStripe.customers.create).toHaveBeenCalledWith(
            { email: 'a@b.com', name: 'A' },
            { idempotencyKey: 'k1' }
        );
    });

    it('updateCustomer sends id first, then the params', async () => {
        await api.updateCustomer('cus_1', { name: 'New' });
        expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_1', { name: 'New' }, {});
        await expect(api.updateCustomer(undefined, { name: 'x' })).rejects.toThrow('id is required');
    });

    it('retrievePaymentIntent sends id and expand (object or array)', async () => {
        await api.retrievePaymentIntent('pi_1', { expand: ['latest_charge'] });
        expect(mockStripe.paymentIntents.retrieve).toHaveBeenLastCalledWith('pi_1', { expand: ['latest_charge'] }, {});
        await api.retrievePaymentIntent('pi_2', ['customer']);
        expect(mockStripe.paymentIntents.retrieve).toHaveBeenLastCalledWith('pi_2', { expand: ['customer'] }, {});
    });

    it('retrieveRefund sends the id', async () => {
        await api.retrieveRefund('re_1');
        expect(mockStripe.refunds.retrieve).toHaveBeenCalledWith('re_1', {}, {});
    });

    it('listPayouts passes status/limit and maps arrivedAfter/Before to arrival_date gt/lt', async () => {
        await api.listPayouts({
            status: 'paid',
            limit: 10,
            arrivedAfter: 1700000000,
            arrivedBefore: '2023-12-01T00:00:00Z',
        });
        expect(mockStripe.payouts.list).toHaveBeenCalledWith(
            { status: 'paid', limit: 10, arrival_date: { gt: 1700000000, lt: 1701388800 } },
            {}
        );
    });
    it('listPayouts sends no arrival_date when no bounds are given', async () => {
        await api.listPayouts({ limit: 1 });
        expect(mockStripe.payouts.list).toHaveBeenCalledWith({ limit: 1 }, {});
    });

    it('rethrows SDK errors', async () => {
        mockStripe.refunds.retrieve.mockRejectedValue(new Error('No such refund'));
        await expect(api.retrieveRefund('re_x')).rejects.toThrow('No such refund');
    });
});
