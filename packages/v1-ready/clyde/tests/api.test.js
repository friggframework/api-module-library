const { Api } = require('../api');

function makeApi(params = { clientKey: 'ck-123', secret: 'sk-123' }) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { data: [] };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Clyde Api', () => {
    describe('auth', () => {
        it('maps clientKey/secret onto Basic auth username/password', () => {
            const api = new Api({ clientKey: 'ck', secret: 'sk' });
            expect(api.clientKey).toBe('ck');
            expect(api.secret).toBe('sk');
            expect(api.username).toBe('ck');
            expect(api.password).toBe('sk');
        });

        it('builds Basic Authorization plus Clyde auth headers', async () => {
            const api = new Api({ clientKey: 'ck', secret: 'sk' });
            const headers = await api.addAuthHeaders({});
            expect(headers['Authorization']).toBe(
                'Basic ' + Buffer.from('ck:sk').toString('base64')
            );
            expect(headers['Content-Type']).toBe('application/vnd.api+json');
            expect(headers['Accept']).toBe('application/vnd.api+json');
            expect(headers['X-Auth-Timestamp']).toMatch(/^\d+$/);
            expect(headers['X-Auth-Nonce']).toMatch(/^[a-f0-9]+$/);
        });

        it('defaults to the documented Clyde base URL', () => {
            const api = new Api({ clientKey: 'ck', secret: 'sk' });
            expect(api.baseUrl).toBe('https://api.joinclyde.com');
        });

        it('honors a baseUrl override', () => {
            const api = new Api({
                clientKey: 'ck',
                secret: 'sk',
                baseUrl: 'https://sandbox.example.com',
            });
            expect(api.baseUrl).toBe('https://sandbox.example.com');
        });

        it('setClientKey / setSecret update Basic credentials', () => {
            const api = new Api({});
            api.setClientKey('new-ck');
            api.setSecret('new-sk');
            expect(api.username).toBe('new-ck');
            expect(api.password).toBe('new-sk');
        });
    });

    describe('products', () => {
        it('getProducts GETs /products with query params', async () => {
            const api = makeApi();
            await api.getProducts({ sku: 'SKU123', page: 2 });
            expect(api.sent[0]).toMatchObject({
                method: 'GET',
                url: 'https://api.joinclyde.com/products',
                query: { sku: 'SKU123', page: 2 },
            });
        });

        it('getProduct GETs /products/{sku}', async () => {
            const api = makeApi();
            await api.getProduct('SKU123');
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/products/SKU123'
            );
        });

        it('createProduct POSTs JSON:API body to /products', async () => {
            const api = makeApi();
            const body = {
                data: { type: 'product', attributes: { sku: 'SKU1', name: 'X' } },
            };
            await api.createProduct(body);
            expect(api.sent[0].method).toBe('POST');
            expect(api.sent[0].url).toBe('https://api.joinclyde.com/products');
            expect(api.sent[0].body).toEqual(body);
        });

        it('updateProduct PUTs /products/{sku}', async () => {
            const api = makeApi();
            await api.updateProduct('SKU1', { data: { type: 'product' } });
            expect(api.sent[0].method).toBe('PUT');
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/products/SKU1'
            );
        });

        it('deleteProduct DELETEs /products/{sku}', async () => {
            const api = makeApi();
            await api.deleteProduct('SKU1');
            expect(api.sent[0].method).toBe('DELETE');
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/products/SKU1'
            );
        });

        it('createProducts POSTs /products/bulk', async () => {
            const api = makeApi();
            await api.createProducts({ data: [] });
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/products/bulk'
            );
        });

        it('getContractsProduct GETs /products/{sku}/contracts', async () => {
            const api = makeApi();
            await api.getContractsProduct('SKU1', { price: 14.99 });
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/products/SKU1/contracts'
            );
            expect(api.sent[0].query).toEqual({ price: 14.99 });
        });
    });

    describe('contracts / orders / sales / claims / vouchers', () => {
        it('getContracts GETs /contracts', async () => {
            const api = makeApi();
            await api.getContracts();
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/contracts'
            );
        });

        it('getOrders / getOrderById / createOrder / updateOrder / cancelOrder', async () => {
            const api = makeApi();
            await api.getOrders({ email: 'a@b.com', page: 1 });
            expect(api.sent[0].query).toEqual({ email: 'a@b.com', page: 1 });

            await api.getOrderById('ord-1');
            expect(api.sent[1].url).toBe(
                'https://api.joinclyde.com/orders/ord-1'
            );

            await api.createOrder({ data: { type: 'order', id: '1' } });
            expect(api.sent[2].method).toBe('POST');

            await api.updateOrder('ord-1', { data: { type: 'order' } });
            expect(api.sent[3].method).toBe('PUT');

            await api.cancelOrder('ord-1');
            expect(api.sent[4].method).toBe('DELETE');
        });

        it('addOrderHistoryEvent PUTs line-item path', async () => {
            const api = makeApi();
            await api.addOrderHistoryEvent('o1', 'li1', {
                data: { type: 'orderHistoryEvent' },
            });
            expect(api.sent[0].method).toBe('PUT');
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/orders/o1/lineItem/li1'
            );
        });

        it('contract sale CRUD paths', async () => {
            const api = makeApi();
            await api.getContractSales({ cancelled: true });
            expect(api.sent[0].url).toBe(
                'https://api.joinclyde.com/contract-sales'
            );
            await api.getContractSaleById('cs-1');
            expect(api.sent[1].url).toBe(
                'https://api.joinclyde.com/contract-sales/cs-1'
            );
            await api.updateContractSale('cs-1', { data: {} });
            expect(api.sent[2].method).toBe('PUT');
            await api.cancelContractSale('cs-1');
            expect(api.sent[3].method).toBe('DELETE');
        });

        it('claims list/get/create paths', async () => {
            const api = makeApi();
            await api.getClaims({ status: 'open' });
            expect(api.sent[0].url).toBe('https://api.joinclyde.com/claims');
            await api.getClaimById('cs-1', 'cl-1');
            expect(api.sent[1].url).toBe(
                'https://api.joinclyde.com/contract-sales/cs-1/claims/cl-1'
            );
            await api.createClaim('cs-1', { data: { type: 'claim' } });
            expect(api.sent[2].method).toBe('POST');
            expect(api.sent[2].url).toBe(
                'https://api.joinclyde.com/contract-sales/cs-1/claims'
            );
        });

        it('voucher paths', async () => {
            const api = makeApi();
            await api.getVouchers();
            expect(api.sent[0].url).toBe('https://api.joinclyde.com/vouchers');
            await api.getVoucher('CODE1');
            expect(api.sent[1].url).toBe(
                'https://api.joinclyde.com/vouchers/CODE1'
            );
            await api.createVouchers({ data: [] });
            expect(api.sent[2].url).toBe(
                'https://api.joinclyde.com/vouchers/bulk'
            );
            await api.updateVoucher('CODE1', { data: {} });
            expect(api.sent[3].method).toBe('PUT');
            await api.deleteVoucher('CODE1');
            expect(api.sent[4].method).toBe('DELETE');
        });
    });
});
