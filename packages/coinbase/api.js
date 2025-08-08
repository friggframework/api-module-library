const { OAuth2Requester, get } = require('@friggframework/core');
const axios = require('axios');
const crypto = require('crypto');

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.clientId = get(params, 'clientId', null);
        this.clientSecret = get(params, 'clientSecret', null);
        this.redirectUri = get(params, 'redirectUri', null);
        this.sandbox = get(params, 'sandbox', false);
        
        // API Key authentication support (for some endpoints)
        this.apiKey = get(params, 'apiKey', null);
        this.apiSecret = get(params, 'apiSecret', null);
        
        this.baseUrl = this.sandbox 
            ? 'https://api.sandbox.coinbase.com'
            : 'https://api.coinbase.com';

        this.tokenUri = 'https://api.coinbase.com/oauth/token';
        this.authorizationUri = 'https://www.coinbase.com/oauth/authorize';
        
        // OAuth2 scopes
        this.scope = get(params, 'scope', [
            'wallet:accounts:read',
            'wallet:transactions:read',
            'wallet:user:read',
        ]).join(' ');

        this.client = axios.create({
            baseURL: this.baseUrl,
        });

        // Add request interceptor for authentication
        this.client.interceptors.request.use((config) => {
            if (this.access_token) {
                config.headers['Authorization'] = `Bearer ${this.access_token}`;
            } else if (this.apiKey && this.apiSecret) {
                const timestamp = Math.floor(Date.now() / 1000);
                const message = timestamp + config.method.toUpperCase() + config.url + (config.data ? JSON.stringify(config.data) : '');
                const signature = crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
                
                config.headers['CB-ACCESS-KEY'] = this.apiKey;
                config.headers['CB-ACCESS-SIGN'] = signature;
                config.headers['CB-ACCESS-TIMESTAMP'] = timestamp;
            }
            config.headers['CB-VERSION'] = '2021-06-23';
            return config;
        });
    }

    // OAuth2 Methods
    async getAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: this.scope,
            state: Math.random().toString(36).substring(7),
        });

        return `${this.authorizationUri}?${params.toString()}`;
    }

    async getTokenFromCode(code) {
        const data = {
            grant_type: 'authorization_code',
            code: code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri,
        };

        const response = await axios.post(this.tokenUri, data);
        await this.setTokens(response.data);
        return response.data;
    }

    async refreshAccessToken(refreshToken) {
        const data = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        };

        const response = await axios.post(this.tokenUri, data);
        await this.setTokens(response.data);
        return response.data;
    }

    // Helper method for API requests
    async makeRequest(method, endpoint, data = null, params = null) {
        try {
            const response = await this.client({
                method,
                url: endpoint,
                data,
                params,
            });
            return response.data;
        } catch (error) {
            throw new Error(`Coinbase API Error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
        }
    }

    // User endpoints
    async getCurrentUser() {
        const response = await this.makeRequest('GET', '/v2/user');
        return response.data;
    }

    async updateUser(params) {
        const response = await this.makeRequest('PUT', '/v2/user', params);
        return response.data;
    }

    // Account endpoints
    async getAccounts(params = {}) {
        const response = await this.makeRequest('GET', '/v2/accounts', null, params);
        return response.data;
    }

    async getAccount(accountId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}`);
        return response.data;
    }

    async createAccount(name) {
        const response = await this.makeRequest('POST', '/v2/accounts', { name });
        return response.data;
    }

    async updateAccount(accountId, name) {
        const response = await this.makeRequest('PUT', `/v2/accounts/${accountId}`, { name });
        return response.data;
    }

    async deleteAccount(accountId) {
        await this.makeRequest('DELETE', `/v2/accounts/${accountId}`);
        return { success: true };
    }

    // Address endpoints
    async getAddresses(accountId, params = {}) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/addresses`, null, params);
        return response.data;
    }

    async getAddress(accountId, addressId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/addresses/${addressId}`);
        return response.data;
    }

    async createAddress(accountId, name = null) {
        const data = name ? { name } : {};
        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/addresses`, data);
        return response.data;
    }

    // Transaction endpoints
    async getTransactions(accountId, params = {}) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/transactions`, null, params);
        return response.data;
    }

    async getTransaction(accountId, transactionId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/transactions/${transactionId}`);
        return response.data;
    }

    async sendMoney(accountId, params) {
        const data = {
            type: 'send',
            to: params.to,
            amount: params.amount,
            currency: params.currency,
            description: params.description,
            idem: params.idem || `send-${Date.now()}`,
        };

        if (params.skipNotifications) {
            data.skip_notifications = true;
        }

        if (params.fee) {
            data.fee = params.fee;
        }

        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/transactions`, data);
        return response.data;
    }

    async transferMoney(fromAccountId, params) {
        const data = {
            type: 'transfer',
            to: params.toAccountId,
            amount: params.amount,
            currency: params.currency,
            description: params.description,
        };

        const response = await this.makeRequest('POST', `/v2/accounts/${fromAccountId}/transactions`, data);
        return response.data;
    }

    async requestMoney(accountId, params) {
        const data = {
            type: 'request',
            to: params.to,
            amount: params.amount,
            currency: params.currency,
            description: params.description,
        };

        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/transactions`, data);
        return response.data;
    }

    // Buy/Sell endpoints
    async getBuys(accountId, params = {}) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/buys`, null, params);
        return response.data;
    }

    async getBuy(accountId, buyId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/buys/${buyId}`);
        return response.data;
    }

    async placeBuyOrder(accountId, params) {
        const data = {
            amount: params.amount,
            currency: params.currency,
            payment_method: params.paymentMethod,
            agree_btc_amount_varies: params.agreeBtcAmountVaries || true,
            commit: params.commit || false,
            quote: params.quote || false,
        };

        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/buys`, data);
        return response.data;
    }

    async commitBuy(accountId, buyId) {
        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/buys/${buyId}/commit`);
        return response.data;
    }

    async getSells(accountId, params = {}) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/sells`, null, params);
        return response.data;
    }

    async getSell(accountId, sellId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/sells/${sellId}`);
        return response.data;
    }

    async placeSellOrder(accountId, params) {
        const data = {
            amount: params.amount,
            currency: params.currency,
            payment_method: params.paymentMethod,
            agree_btc_amount_varies: params.agreeBtcAmountVaries || true,
            commit: params.commit || false,
            quote: params.quote || false,
        };

        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/sells`, data);
        return response.data;
    }

    async commitSell(accountId, sellId) {
        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/sells/${sellId}/commit`);
        return response.data;
    }

    // Deposit/Withdrawal endpoints
    async getDeposits(accountId, params = {}) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/deposits`, null, params);
        return response.data;
    }

    async getDeposit(accountId, depositId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/deposits/${depositId}`);
        return response.data;
    }

    async depositFunds(accountId, params) {
        const data = {
            amount: params.amount,
            currency: params.currency,
            payment_method: params.paymentMethod,
            commit: params.commit || false,
        };

        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/deposits`, data);
        return response.data;
    }

    async commitDeposit(accountId, depositId) {
        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/deposits/${depositId}/commit`);
        return response.data;
    }

    async getWithdrawals(accountId, params = {}) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/withdrawals`, null, params);
        return response.data;
    }

    async getWithdrawal(accountId, withdrawalId) {
        const response = await this.makeRequest('GET', `/v2/accounts/${accountId}/withdrawals/${withdrawalId}`);
        return response.data;
    }

    async withdrawFunds(accountId, params) {
        const data = {
            amount: params.amount,
            currency: params.currency,
            payment_method: params.paymentMethod,
            commit: params.commit || false,
        };

        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/withdrawals`, data);
        return response.data;
    }

    async commitWithdrawal(accountId, withdrawalId) {
        const response = await this.makeRequest('POST', `/v2/accounts/${accountId}/withdrawals/${withdrawalId}/commit`);
        return response.data;
    }

    // Payment method endpoints
    async getPaymentMethods(params = {}) {
        const response = await this.makeRequest('GET', '/v2/payment-methods', null, params);
        return response.data;
    }

    async getPaymentMethod(paymentMethodId) {
        const response = await this.makeRequest('GET', `/v2/payment-methods/${paymentMethodId}`);
        return response.data;
    }

    // Price data endpoints
    async getExchangeRates(currency = 'USD') {
        const response = await this.makeRequest('GET', `/v2/exchange-rates`, null, { currency });
        return response.data;
    }

    async getBuyPrice(currencyPair) {
        const response = await this.makeRequest('GET', `/v2/prices/${currencyPair}/buy`);
        return response.data;
    }

    async getSellPrice(currencyPair) {
        const response = await this.makeRequest('GET', `/v2/prices/${currencyPair}/sell`);
        return response.data;
    }

    async getSpotPrice(currencyPair, date = null) {
        const params = date ? { date } : {};
        const response = await this.makeRequest('GET', `/v2/prices/${currencyPair}/spot`, null, params);
        return response.data;
    }

    // Currency endpoints
    async getCurrencies() {
        const response = await this.makeRequest('GET', '/v2/currencies');
        return response.data;
    }

    async getCurrency(currencyCode) {
        const response = await this.makeRequest('GET', `/v2/currencies/${currencyCode}`);
        return response.data;
    }

    // Time endpoint
    async getTime() {
        const response = await this.makeRequest('GET', '/v2/time');
        return response.data;
    }

    // Notification endpoints
    async getNotifications(params = {}) {
        const response = await this.makeRequest('GET', '/v2/notifications', null, params);
        return response.data;
    }

    async getNotification(notificationId) {
        const response = await this.makeRequest('GET', `/v2/notifications/${notificationId}`);
        return response.data;
    }

    // Webhook verification
    verifyWebhookSignature(payload, signature) {
        const expectedSignature = crypto
            .createHmac('sha256', this.clientSecret)
            .update(payload)
            .digest('hex');
        
        return signature === expectedSignature;
    }
}

module.exports = { Api };