const AuthFields = {
    jsonSchema: {
        type: 'object',
        required: ['client_id', 'client_secret', 'app_key', 'tenant_id'],
        properties: {
            environment: {
                type: 'string',
                title: 'Environment',
                enum: ['production', 'integration'],
                default: 'production',
            },
            tenant_id: {
                type: 'string',
                title: 'Tenant ID',
            },
            app_key: {
                type: 'string',
                title: 'App Key',
            },
            client_id: {
                type: 'string',
                title: 'Client ID',
            },
            client_secret: {
                type: 'string',
                title: 'Client Secret',
            },
        },
    },
    uiSchema: {
        environment: {
            'ui:help':
                'Use Integration while testing against a sandbox tenant. Credentials are not interchangeable between environments.',
        },
        tenant_id: {
            'ui:placeholder': '123456789',
            'ui:help':
                'In ServiceTitan go to Settings > Integrations > API Application Access. Your Tenant ID is shown at the top of that page.',
        },
        app_key: {
            'ui:widget': 'password',
            'ui:help':
                'Generated with your app in the ServiceTitan Developer Portal. Sent on every request as the ST-App-Key header.',
        },
        client_id: {
            'ui:placeholder': 'Client ID',
            'ui:help':
                'After an admin connects the app under Settings > Integrations > API Application Access, ServiceTitan shows the Client ID and Secret. The Secret is only shown once.',
        },
        client_secret: {
            'ui:widget': 'password',
            'ui:help':
                'Shown only once when the app is connected. If it has been lost, regenerate it from API Application Access.',
        },
    },
};

module.exports = AuthFields;
