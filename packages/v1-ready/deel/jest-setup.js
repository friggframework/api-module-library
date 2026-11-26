const hasLiveCredentials =
    process.env.DEEL_CLIENT_ID &&
    process.env.DEEL_CLIENT_SECRET &&
    process.env.REDIRECT_URI &&
    process.env.DEEL_SCOPE;

module.exports = async () => {
    // Offline host/unit tests do not need MongoMemoryServer.
    if (!hasLiveCredentials) {
        return;
    }
    const {globalSetup} = require('@friggframework/test');
    return globalSetup();
};
