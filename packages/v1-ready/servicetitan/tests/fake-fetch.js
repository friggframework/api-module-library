// A recording fetch double.
//
// Tests here assert on the *request* — URL, method, headers, body — rather than
// on a canned response. A mock that only feeds back the shape the code wants
// cannot catch a wrong tenant path, a missing ST-App-Key, or a JSON body sent
// where ServiceTitan requires form encoding.
function createFakeFetch(responders = []) {
    const calls = [];
    const queue = [...responders];

    const fakeFetch = async (url, options) => {
        calls.push({
            url,
            method: options.method,
            headers: options.headers,
            body: options.body,
            query: options.query,
        });

        const responder = queue.length > 1 ? queue.shift() : queue[0];
        const result =
            typeof responder === 'function' ? responder(url, options) : responder;
        const { status = 200, body = {}, contentType = 'application/json' } =
            result || {};

        return {
            status,
            headers: { get: (name) => (name === 'Content-Type' ? contentType : null) },
            json: async () => body,
            text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        };
    };

    fakeFetch.calls = calls;
    fakeFetch.lastCall = () => calls[calls.length - 1];
    return fakeFetch;
}

const TOKEN_RESPONSE = {
    body: { access_token: 'test-access-token', expires_in: 900, token_type: 'Bearer' },
};

module.exports = { createFakeFetch, TOKEN_RESPONSE };
