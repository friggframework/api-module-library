const { Requester, get } = require('@friggframework/core');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

class Api extends Requester {
    constructor(params = {}) {
        super(params);

        this.clientId = get(params, 'clientId', null);
        this.secret = get(params, 'secret', null);
        this.environment = get(params, 'environment', 'sandbox');
        this.redirectUri = get(params, 'redirectUri', null);
        this.accessToken = get(params, 'accessToken', null);
        
        // Initialize Plaid configuration
        const plaidEnv = this.environment === 'production' 
            ? PlaidEnvironments.production 
            : this.environment === 'development' 
            ? PlaidEnvironments.development 
            : PlaidEnvironments.sandbox;

        const configuration = new Configuration({
            basePath: plaidEnv,
            baseOptions: {
                headers: {
                    'PLAID-CLIENT-ID': this.clientId,
                    'PLAID-SECRET': this.secret,
                },
            },
        });

        this.client = new PlaidApi(configuration);
    }

    // Link token creation for Plaid Link
    async createLinkToken(params = {}) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            user: {
                client_user_id: params.userId || 'user-' + Date.now(),
            },
            client_name: params.clientName || 'Frigg Framework App',
            products: params.products || ['transactions', 'accounts', 'balances'],
            country_codes: params.countryCodes || ['US'],
            language: params.language || 'en',
            redirect_uri: this.redirectUri,
            webhook: params.webhook,
        };

        if (params.accessToken) {
            request.access_token = params.accessToken;
        }

        const response = await this.client.linkTokenCreate(request);
        return response.data;
    }

    // Exchange public token for access token
    async exchangePublicToken(publicToken) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            public_token: publicToken,
        };

        const response = await this.client.itemPublicTokenExchange(request);
        this.accessToken = response.data.access_token;
        return response.data;
    }

    // Get accounts
    async getAccounts(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.accountsGet(request);
        return response.data;
    }

    // Get account balances
    async getBalances(accessToken = null, accountIds = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        if (accountIds) {
            request.options = { account_ids: accountIds };
        }

        const response = await this.client.accountsBalanceGet(request);
        return response.data;
    }

    // Get transactions
    async getTransactions(startDate, endDate, params = {}) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: params.accessToken || this.accessToken,
            start_date: startDate,
            end_date: endDate,
            options: {
                count: params.count || 100,
                offset: params.offset || 0,
                account_ids: params.accountIds,
                include_personal_finance_category: params.includeCategories || false,
            },
        };

        const response = await this.client.transactionsGet(request);
        return response.data;
    }

    // Sync transactions (for incremental updates)
    async syncTransactions(cursor = null, params = {}) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: params.accessToken || this.accessToken,
        };

        if (cursor) {
            request.cursor = cursor;
        }

        if (params.count) {
            request.count = params.count;
        }

        const response = await this.client.transactionsSync(request);
        return response.data;
    }

    // Get item (institution) details
    async getItem(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.itemGet(request);
        return response.data;
    }

    // Get institution by ID
    async getInstitutionById(institutionId, countryCodes = ['US']) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            institution_id: institutionId,
            country_codes: countryCodes,
        };

        const response = await this.client.institutionsGetById(request);
        return response.data;
    }

    // Search institutions
    async searchInstitutions(query, countryCodes = ['US'], products = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            query: query,
            country_codes: countryCodes,
        };

        if (products) {
            request.products = products;
        }

        const response = await this.client.institutionsSearch(request);
        return response.data;
    }

    // Get identity information
    async getIdentity(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.identityGet(request);
        return response.data;
    }

    // Get investment holdings
    async getInvestmentHoldings(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.investmentsHoldingsGet(request);
        return response.data;
    }

    // Get investment transactions
    async getInvestmentTransactions(startDate, endDate, params = {}) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: params.accessToken || this.accessToken,
            start_date: startDate,
            end_date: endDate,
            options: {
                count: params.count || 100,
                offset: params.offset || 0,
                account_ids: params.accountIds,
            },
        };

        const response = await this.client.investmentsTransactionsGet(request);
        return response.data;
    }

    // Get liabilities
    async getLiabilities(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.liabilitiesGet(request);
        return response.data;
    }

    // Create processor token for integrations (e.g., Stripe, Dwolla)
    async createProcessorToken(accountId, processor, accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
            account_id: accountId,
            processor: processor,
        };

        const response = await this.client.processorTokenCreate(request);
        return response.data;
    }

    // Remove item (unlink bank account)
    async removeItem(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.itemRemove(request);
        return response.data;
    }

    // Update webhook URL
    async updateWebhook(webhook, accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
            webhook: webhook,
        };

        const response = await this.client.itemWebhookUpdate(request);
        return response.data;
    }

    // Force refresh transactions
    async refreshTransactions(accessToken = null) {
        const request = {
            client_id: this.clientId,
            secret: this.secret,
            access_token: accessToken || this.accessToken,
        };

        const response = await this.client.transactionsRefresh(request);
        return response.data;
    }

    // Get categories
    async getCategories() {
        const request = {};
        const response = await this.client.categoriesGet(request);
        return response.data;
    }
}

module.exports = { Api };