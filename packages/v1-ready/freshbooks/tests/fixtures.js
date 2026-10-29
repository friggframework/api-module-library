const nock = require('nock');

const REDIRECT_URI = 'https://app.example.com/redirect';

const TOKEN_RESPONSE = {
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    expires_in: 43200,
    token_type: 'Bearer',
};

const business = (accountId, name) => ({
    business: { account_id: accountId, name },
});

const userWith = (...memberships) => ({
    id: 42,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    business_memberships: memberships,
});

const USER = userWith(business('acct-1', 'Analytical Engines Ltd'));

const setFreshbooksEnv = () => {
    process.env.FRESHBOOKS_CLIENT_ID = 'client-id';
    process.env.FRESHBOOKS_CLIENT_SECRET = 'client-secret';
    process.env.REDIRECT_URI = REDIRECT_URI;
};

const useMockedHttp = () => {
    beforeAll(() => nock.disableNetConnect());
    afterEach(() => nock.cleanAll());
    afterAll(() => nock.enableNetConnect());
};

module.exports = {
    REDIRECT_URI,
    TOKEN_RESPONSE,
    USER,
    business,
    userWith,
    setFreshbooksEnv,
    useMockedHttp,
};
