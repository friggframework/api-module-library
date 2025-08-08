const { ApiKeyRequester, get, FriggError } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.datadoghq.com';
        
        this.URLs = {
            validate: '/api/v1/validate',
            metrics: '/api/v1/series',
            events: '/api/v1/events',
            logs: '/api/v1/logs',
            dashboards: '/api/v1/dashboard',
            monitors: '/api/v1/monitor'
        };
        
        // Set up API key authentication
        this.addAuthHeaders();
    }

    addAuthHeaders() {
        if (this.apiKey) {
            this.setDefaultHeaders({
                'DD-API-KEY': this.apiKey,
                'DD-APPLICATION-KEY': this.applicationKey,
                'Content-Type': 'application/json'
            });
        }
    }

    static Definition = {
        DISPLAY_NAME: 'Datadog',
        MODULE_NAME: 'datadog',
        CATEGORY: 'Monitoring',
        USES_OAUTH: false
    };

    // Validation
    async validateApiKey() {
        return this.get(this.URLs.validate);
    }

    // Metrics
    async submitMetrics(data) {
        return this.post(this.URLs.metrics, data);
    }

    // Events
    async createEvent(event) {
        return this.post(this.URLs.events, event);
    }

    async listEvents(params = {}) {
        return this.get(this.URLs.events, params);
    }

    // Logs
    async searchLogs(query) {
        return this.post(this.URLs.logs + '/search', { query });
    }

    // Dashboards
    async listDashboards() {
        return this.get(this.URLs.dashboards);
    }

    async createDashboard(dashboard) {
        return this.post(this.URLs.dashboards, dashboard);
    }

    // Monitors
    async listMonitors() {
        return this.get(this.URLs.monitors);
    }

    async createMonitor(monitor) {
        return this.post(this.URLs.monitors, monitor);
    }
}

module.exports = { Api };
