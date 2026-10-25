'use strict';

module.exports = async function firstCall(Api, accessToken) {
    const api = new Api({access_token: accessToken});
    return api.listContacts({limit: 1, properties: ['email']});
};
