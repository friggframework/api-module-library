const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.payjunction.com';
        this.api_key = get(params, 'api_key', null);
        this.URLs = {
            transactions: '/transactions',
            transactionById: (id) => `/transactions/${id}`,
            customers: '/customers',
            customerById: (id) => `/customers/${id}`
        };
    }

    // Add the API key to the headers
    addAuthHeaders(headers = {}) {
        return {
            ...headers,
            'Authorization': `Basic ${this.api_key}`,
            'Content-Type': 'application/json'
        };
    }

    // Example: List transactions (test auth)
    async testAuth() {
        return this._get({
            url: this.baseUrl + this.URLs.transactions,
            headers: this.addAuthHeaders()
        });
    }

    // List transactions
    async listTransactions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.transactions,
            query: params,
            headers: this.addAuthHeaders()
        });
    }

    // Get transaction by ID
    async getTransactionById(id) {
        return this._get({
            url: this.baseUrl + this.URLs.transactionById(id),
            headers: this.addAuthHeaders()
        });
    }

    // List customers
    async listCustomers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            query: params,
            headers: this.addAuthHeaders()
        });
    }

    // Get customer by ID
    async getCustomerById(id) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(id),
            headers: this.addAuthHeaders()
        });
    }

    // Add more methods as needed for PayJunction endpoints
}

module.exports = { Api }; 