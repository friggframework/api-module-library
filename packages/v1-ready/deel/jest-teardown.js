const hasLiveCredentials =
    process.env.DEEL_CLIENT_ID &&
    process.env.DEEL_CLIENT_SECRET &&
    process.env.REDIRECT_URI &&
    process.env.DEEL_SCOPE;

module.exports = async () => {
    if (!hasLiveCredentials) {
        return;
    }
    const {globalTeardown} = require('@friggframework/test');
    return globalTeardown();
};
