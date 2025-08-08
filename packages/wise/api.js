const { Requester, get } = require('@friggframework/core');
const axios = require('axios');

class Api extends Requester {
    constructor(params = {}) {
        super(params);

        this.apiToken = get(params, 'apiToken', null);
        this.sandbox = get(params, 'sandbox', true);
        this.profileId = get(params, 'profileId', null);
        
        this.baseUrl = this.sandbox 
            ? 'https://api.sandbox.transferwise.tech'
            : 'https://api.wise.com';

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
            },
        });
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
            throw new Error(`Wise API Error: ${error.response?.data?.message || error.message}`);
        }
    }

    // Get user profiles
    async getProfiles() {
        return this.makeRequest('GET', '/v1/profiles');
    }

    // Set active profile
    setProfile(profileId) {
        this.profileId = profileId;
    }

    // Get profile by ID
    async getProfile(profileId = null) {
        const id = profileId || this.profileId;
        return this.makeRequest('GET', `/v1/profiles/${id}`);
    }

    // Get multi-currency account balances
    async getBalances(profileId = null) {
        const id = profileId || this.profileId;
        return this.makeRequest('GET', `/v4/profiles/${id}/balances?types=STANDARD`);
    }

    // Get balance for specific currency
    async getBalance(currency, profileId = null) {
        const balances = await this.getBalances(profileId);
        return balances.find(b => b.currency === currency);
    }

    // Create a quote
    async createQuote(params) {
        const profileId = params.profileId || this.profileId;
        const quoteData = {
            sourceCurrency: params.sourceCurrency,
            targetCurrency: params.targetCurrency,
            sourceAmount: params.sourceAmount || null,
            targetAmount: params.targetAmount || null,
            profile: profileId,
            payOut: params.payOut || 'BALANCE',
            preferredPayIn: params.preferredPayIn || 'BALANCE',
        };

        return this.makeRequest('POST', '/v3/profiles/' + profileId + '/quotes', quoteData);
    }

    // Get quote by ID
    async getQuote(quoteId, profileId = null) {
        const id = profileId || this.profileId;
        return this.makeRequest('GET', `/v3/profiles/${id}/quotes/${quoteId}`);
    }

    // List recipients
    async getRecipients(currency = null, profileId = null) {
        const id = profileId || this.profileId;
        const params = currency ? { currency } : {};
        return this.makeRequest('GET', `/v1/accounts?profile=${id}`, null, params);
    }

    // Get recipient by ID
    async getRecipient(recipientId) {
        return this.makeRequest('GET', `/v1/accounts/${recipientId}`);
    }

    // Create recipient
    async createRecipient(params) {
        const profileId = params.profileId || this.profileId;
        const recipientData = {
            profile: profileId,
            accountHolderName: params.accountHolderName,
            currency: params.currency,
            type: params.type || params.accountType,
            details: params.details,
            ownedByCustomer: params.ownedByCustomer !== false,
        };

        return this.makeRequest('POST', '/v1/accounts', recipientData);
    }

    // Delete recipient
    async deleteRecipient(recipientId) {
        return this.makeRequest('DELETE', `/v1/accounts/${recipientId}`);
    }

    // Get recipient requirements for a currency/country
    async getRecipientRequirements(params) {
        const queryParams = {
            source: params.sourceCurrency,
            target: params.targetCurrency,
            sourceAmount: params.sourceAmount || 1000,
        };
        
        return this.makeRequest('GET', '/v1/account-requirements', null, queryParams);
    }

    // Create a transfer
    async createTransfer(params) {
        const profileId = params.profileId || this.profileId;
        const transferData = {
            sourceCurrency: params.sourceCurrency,
            targetCurrency: params.targetCurrency,
            sourceAmount: params.sourceAmount || null,
            targetAmount: params.targetAmount || null,
            profile: profileId,
            targetAccount: params.recipientId || params.targetAccount,
            quote: params.quoteId,
            customerTransactionId: params.customerTransactionId || `transfer-${Date.now()}`,
            details: {
                reference: params.reference || '',
                transferPurpose: params.transferPurpose,
                transferPurposeSubTransferPurpose: params.transferPurposeSubTransferPurpose,
                sourceOfFunds: params.sourceOfFunds || 'verification.source.of.funds.other',
            },
        };

        return this.makeRequest('POST', '/v1/transfers', transferData);
    }

    // Get transfer by ID
    async getTransfer(transferId) {
        return this.makeRequest('GET', `/v1/transfers/${transferId}`);
    }

    // List transfers
    async getTransfers(params = {}, profileId = null) {
        const id = profileId || this.profileId;
        const queryParams = {
            profile: id,
            limit: params.limit || 100,
            offset: params.offset || 0,
            status: params.status,
            createdDateStart: params.createdDateStart,
            createdDateEnd: params.createdDateEnd,
        };

        // Remove undefined values
        Object.keys(queryParams).forEach(key => 
            queryParams[key] === undefined && delete queryParams[key]
        );

        return this.makeRequest('GET', '/v1/transfers', null, queryParams);
    }

    // Cancel transfer
    async cancelTransfer(transferId) {
        return this.makeRequest('PUT', `/v1/transfers/${transferId}/cancel`);
    }

    // Fund transfer (simulate payment in sandbox)
    async fundTransfer(transferId, profileId = null) {
        const id = profileId || this.profileId;
        return this.makeRequest('POST', `/v3/profiles/${id}/transfers/${transferId}/payments`, {
            type: 'BALANCE',
        });
    }

    // Get transfer delivery time
    async getDeliveryTime(params) {
        const queryParams = {
            sourceCurrency: params.sourceCurrency,
            targetCurrency: params.targetCurrency,
            payIn: params.payIn || 'BALANCE',
            payOut: params.payOut || 'BALANCE',
        };

        return this.makeRequest('GET', '/v1/delivery-estimates', null, queryParams);
    }

    // Get exchange rates
    async getExchangeRates(source = null, target = null) {
        const params = {};
        if (source) params.source = source;
        if (target) params.target = target;
        
        return this.makeRequest('GET', '/v1/rates', null, params);
    }

    // Get supported currencies
    async getCurrencies() {
        return this.makeRequest('GET', '/v1/currencies');
    }

    // Get currency pairs
    async getCurrencyPairs() {
        return this.makeRequest('GET', '/v1/currency-pairs');
    }

    // Webhook signature verification
    verifyWebhookSignature(payload, signature, secret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        return signature === expectedSignature;
    }

    // Create webhook subscription
    async createWebhookSubscription(params) {
        const profileId = params.profileId || this.profileId;
        const subscriptionData = {
            name: params.name || 'Frigg Webhook',
            trigger_on: params.events || 'transfers#state-change',
            delivery: {
                version: '2.0.0',
                url: params.url,
            },
            scope: {
                profile: profileId,
            },
        };

        return this.makeRequest('POST', '/v3/profiles/' + profileId + '/subscriptions', subscriptionData);
    }

    // List webhook subscriptions
    async getWebhookSubscriptions(profileId = null) {
        const id = profileId || this.profileId;
        return this.makeRequest('GET', `/v3/profiles/${id}/subscriptions`);
    }

    // Delete webhook subscription
    async deleteWebhookSubscription(subscriptionId, profileId = null) {
        const id = profileId || this.profileId;
        return this.makeRequest('DELETE', `/v3/profiles/${id}/subscriptions/${subscriptionId}`);
    }

    // Get transfer wise fees
    async getTransferFees(params) {
        const queryParams = {
            sourceCurrency: params.sourceCurrency,
            targetCurrency: params.targetCurrency,
            sourceAmount: params.sourceAmount || null,
            targetAmount: params.targetAmount || null,
            payIn: params.payIn || 'BALANCE',
            payOut: params.payOut || 'BANK_TRANSFER',
        };

        // Remove null values
        Object.keys(queryParams).forEach(key => 
            queryParams[key] === null && delete queryParams[key]
        );

        return this.makeRequest('GET', '/v1/quotes/fees', null, queryParams);
    }

    // Get bank details requirements
    async getBankRequirements(currency, country = null) {
        const params = { currency };
        if (country) params.country = country;
        
        return this.makeRequest('GET', '/v1/bank-requirements', null, params);
    }
}

module.exports = { Api };