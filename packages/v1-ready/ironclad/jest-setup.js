const { globalSetup } = require('@friggframework/test');

module.exports = async () => {
    globalSetup();

    process.env = {
        ...process.env,
        IRONCLAD_CLIENT_ID: 'some-client-id',
        IRONCLAD_CLIENT_SECRET: 'some-client-secret',
        IRONCLAD_SCOPE: 'scope1 scope2',
        IRONCLAD_SUBDOMAIN: 'subdomain',
        REDIRECT_URI: 'https://example.com',
    };
};
