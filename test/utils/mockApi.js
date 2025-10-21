function mockApi(ApiClass, options = {}) {
    const { authenticationMode = 'browser', filteringScope } = options;
    let apiInstance = null;

    return {
        async initialize(config) {
            return Promise.resolve();
        },

        async mock() {
            const mockParams = {
                access_token: 'mock_access_token',
                refresh_token: 'mock_refresh_token',
                client_id: process.env.CLIENT_ID || 'mock_client_id',
                client_secret: process.env.CLIENT_SECRET || 'mock_client_secret',
                redirect_uri: process.env.REDIRECT_URI || 'http://localhost:3000/callback',
                scope: process.env.SCOPE || 'read write',
                companyDomain: process.env.COMPANY_DOMAIN || 'https://test.pipedrive.com',
            };

            apiInstance = new ApiClass(mockParams);
            return apiInstance;
        },

        async clean(config) {
            apiInstance = null;
            return Promise.resolve();
        },
    };
}

module.exports = { mockApi };
