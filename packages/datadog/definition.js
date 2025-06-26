const { get } = require('@friggframework/core');

class Definition {
    constructor(params) {
        this.id = get(params, 'id');
        this.userId = get(params, 'userId');
        this.apiKey = get(params, 'apiKey');
        this.applicationKey = get(params, 'applicationKey');
    }

    static Config = {
        name: 'datadog',
        authType: 'apiKey',
        env: {
            api_key: process.env.DATADOG_API_KEY,
            application_key: process.env.DATADOG_APPLICATION_KEY
        }
    };
}

module.exports = { Definition };
