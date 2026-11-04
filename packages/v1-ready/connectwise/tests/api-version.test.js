const {Api, DEFAULT_API_VERSION} = require('../api');

const baseParams = {
    company_id: 'acme',
    public_key: 'pub',
    private_key: 'priv',
    client_id: 'client-123',
    site: 'https://api-na.myconnectwise.net',
};

describe('ConnectWise API version (offline)', () => {
    const originalEnv = process.env.CONNECTWISE_API_VERSION;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.CONNECTWISE_API_VERSION;
        } else {
            process.env.CONNECTWISE_API_VERSION = originalEnv;
        }
    });

    it('defaults Accept version to 2019.1', async () => {
        delete process.env.CONNECTWISE_API_VERSION;
        const api = new Api(baseParams);
        expect(DEFAULT_API_VERSION).toBe('2019.1');
        expect(api.api_version).toBe('2019.1');

        const headers = await api.addAuthHeaders({});
        expect(headers.Accept).toBe(
            'application/vnd.connectwise.com+json; version=2019.1'
        );
        expect(headers.clientId).toBe('client-123');
        expect(headers.authorization).toMatch(/^Basic /);
    });

    it('honors CONNECTWISE_API_VERSION env override', async () => {
        process.env.CONNECTWISE_API_VERSION = '2026.11';
        const api = new Api(baseParams);
        expect(api.api_version).toBe('2026.11');
        const headers = await api.addAuthHeaders({});
        expect(headers.Accept).toBe(
            'application/vnd.connectwise.com+json; version=2026.11'
        );
    });

    it('honors constructor api_version over env', async () => {
        process.env.CONNECTWISE_API_VERSION = '2026.11';
        const api = new Api({...baseParams, api_version: '2022.1'});
        expect(api.api_version).toBe('2022.1');
        const headers = await api.addAuthHeaders({});
        expect(headers.Accept).toBe(
            'application/vnd.connectwise.com+json; version=2022.1'
        );
    });

    it('applies Accept on GET and POST via addAuthHeaders', async () => {
        delete process.env.CONNECTWISE_API_VERSION;
        const api = new Api(baseParams);
        const captured = [];
        api.fetch = async (url, options) => {
            captured.push({url, options});
            return {
                status: 200,
                headers: {get: () => 'application/json'},
                json: async () => ({}),
                text: async () => '{}',
            };
        };

        await api._get({url: api.urls.companies});
        await api._post({url: api.urls.companies, body: {name: 'Acme'}});

        expect(captured).toHaveLength(2);
        expect(captured[0].options.method).toBe('GET');
        expect(captured[0].options.headers.Accept).toBe(
            'application/vnd.connectwise.com+json; version=2019.1'
        );
        expect(captured[1].options.method).toBe('POST');
        expect(captured[1].options.headers.Accept).toBe(
            'application/vnd.connectwise.com+json; version=2019.1'
        );
        expect(captured[1].options.headers['content-type']).toBe(
            'application/json'
        );
    });
});
