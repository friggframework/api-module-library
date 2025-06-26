const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.replicate.com/v1';
        
        this.URLs = {
            // Predictions
            predictions: '/predictions',
            predictionById: (predictionId) => `/predictions/${predictionId}`,
            predictionCancel: (predictionId) => `/predictions/${predictionId}/cancel`,
            
            // Models
            models: '/models',
            modelVersions: (owner, name) => `/models/${owner}/${name}/versions`,
            modelVersion: (owner, name, versionId) => `/models/${owner}/${name}/versions/${versionId}`,
            
            // Collections
            collections: '/collections',
            collectionBySlug: (slug) => `/collections/${slug}`,
            
            // Deployments
            deployments: '/deployments',
            deploymentById: (owner, name) => `/deployments/${owner}/${name}`,
            deploymentPredictions: (owner, name) => `/deployments/${owner}/${name}/predictions`,
            
            // Hardware
            hardware: '/hardware',
            
            // Account
            account: '/account',
            
            // Webhooks
            webhookSecret: '/webhooks/default/secret',
        };
        
        this.predictionStatus = {
            STARTING: 'starting',
            PROCESSING: 'processing',
            SUCCEEDED: 'succeeded',
            FAILED: 'failed',
            CANCELED: 'canceled',
        };
    }
    
    async addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }
    
    async _get(options) {
        await this.addAuthHeaders(options);
        return super._get(options);
    }
    
    async _post(options, stringify = true) {
        await this.addAuthHeaders(options);
        return super._post(options, stringify);
    }
    
    async _put(options, stringify = true) {
        await this.addAuthHeaders(options);
        return super._put(options, stringify);
    }
    
    async _patch(options, stringify = true) {
        await this.addAuthHeaders(options);
        return super._patch(options, stringify);
    }
    
    async _delete(options) {
        await this.addAuthHeaders(options);
        return super._delete(options);
    }
    
    // **************************   Predictions   **********************************
    
    async createPrediction(params) {
        const options = {
            url: this.baseUrl + this.URLs.predictions,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createPredictionAndWait(params, options = {}) {
        const prediction = await this.createPrediction(params);
        return this.waitForPrediction(prediction.id, options);
    }
    
    async getPrediction(predictionId) {
        const options = {
            url: this.baseUrl + this.URLs.predictionById(predictionId),
        };
        
        return this._get(options);
    }
    
    async cancelPrediction(predictionId) {
        const options = {
            url: this.baseUrl + this.URLs.predictionCancel(predictionId),
        };
        
        return this._post(options);
    }
    
    async listPredictions(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.predictions,
            query: params,
        };
        
        return this._get(options);
    }
    
    async waitForPrediction(predictionId, options = {}) {
        const maxWait = options.maxWait || 60000; // 60 seconds default
        const interval = options.interval || 500; // 500ms default
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const prediction = await this.getPrediction(predictionId);
            
            if (prediction.status === this.predictionStatus.SUCCEEDED) {
                return prediction;
            }
            
            if (prediction.status === this.predictionStatus.FAILED || 
                prediction.status === this.predictionStatus.CANCELED) {
                throw new Error(`Prediction ${prediction.status}: ${prediction.error || 'Unknown error'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error(`Prediction timeout after ${maxWait}ms`);
    }
    
    // **************************   Models   **********************************
    
    async getModel(owner, name) {
        const versions = await this.listModelVersions(owner, name);
        // The first version contains model metadata
        return versions.results[0] || null;
    }
    
    async listModelVersions(owner, name) {
        const options = {
            url: this.baseUrl + this.URLs.modelVersions(owner, name),
        };
        
        return this._get(options);
    }
    
    async getModelVersion(owner, name, versionId) {
        const options = {
            url: this.baseUrl + this.URLs.modelVersion(owner, name, versionId),
        };
        
        return this._get(options);
    }
    
    async searchModels(query) {
        // Note: Replicate doesn't have a direct model search endpoint
        // This uses collections as a workaround
        const collections = await this.listCollections();
        const models = [];
        
        for (const collection of collections.results) {
            if (collection.name.toLowerCase().includes(query.toLowerCase()) ||
                collection.description.toLowerCase().includes(query.toLowerCase())) {
                const collectionModels = await this.getCollection(collection.slug);
                models.push(...collectionModels.models);
            }
        }
        
        return models;
    }
    
    // **************************   Collections   **********************************
    
    async listCollections() {
        const options = {
            url: this.baseUrl + this.URLs.collections,
        };
        
        return this._get(options);
    }
    
    async getCollection(slug) {
        const options = {
            url: this.baseUrl + this.URLs.collectionBySlug(slug),
        };
        
        return this._get(options);
    }
    
    // **************************   Deployments   **********************************
    
    async listDeployments() {
        const options = {
            url: this.baseUrl + this.URLs.deployments,
        };
        
        return this._get(options);
    }
    
    async getDeployment(owner, name) {
        const options = {
            url: this.baseUrl + this.URLs.deploymentById(owner, name),
        };
        
        return this._get(options);
    }
    
    async createDeploymentPrediction(owner, name, params) {
        const options = {
            url: this.baseUrl + this.URLs.deploymentPredictions(owner, name),
            body: params,
        };
        
        return this._post(options);
    }
    
    async createDeploymentPredictionAndWait(owner, name, params, options = {}) {
        const prediction = await this.createDeploymentPrediction(owner, name, params);
        return this.waitForPrediction(prediction.id, options);
    }
    
    // **************************   Hardware   **********************************
    
    async listHardware() {
        const options = {
            url: this.baseUrl + this.URLs.hardware,
        };
        
        return this._get(options);
    }
    
    // **************************   Account   **********************************
    
    async getAccount() {
        const options = {
            url: this.baseUrl + this.URLs.account,
        };
        
        return this._get(options);
    }
    
    // **************************   Webhooks   **********************************
    
    async getWebhookSecret() {
        const options = {
            url: this.baseUrl + this.URLs.webhookSecret,
        };
        
        return this._get(options);
    }
    
    // **************************   High-Level Helpers   **********************************
    
    async run(model, input, options = {}) {
        // Parse model string (format: owner/name:version or owner/name)
        const parts = model.split(':');
        const [owner, name] = parts[0].split('/');
        const version = parts[1] || 'latest';
        
        let versionId = version;
        
        // If version is 'latest', get the latest version
        if (version === 'latest') {
            const versions = await this.listModelVersions(owner, name);
            if (versions.results && versions.results.length > 0) {
                versionId = versions.results[0].id;
            } else {
                throw new Error(`No versions found for model ${owner}/${name}`);
            }
        }
        
        // Create prediction
        const predictionParams = {
            version: versionId,
            input: input,
        };
        
        if (options.webhook) {
            predictionParams.webhook = options.webhook;
            predictionParams.webhook_events_filter = options.webhook_events_filter || ['completed'];
        }
        
        if (options.wait !== false) {
            return this.createPredictionAndWait(predictionParams, options);
        } else {
            return this.createPrediction(predictionParams);
        }
    }
    
    async runWithProgress(model, input, progressCallback, options = {}) {
        // Create initial prediction
        const prediction = await this.run(model, input, { ...options, wait: false });
        
        // Poll for updates
        const maxWait = options.maxWait || 60000;
        const interval = options.interval || 500;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const current = await this.getPrediction(prediction.id);
            
            if (progressCallback) {
                progressCallback(current);
            }
            
            if (current.status === this.predictionStatus.SUCCEEDED) {
                return current;
            }
            
            if (current.status === this.predictionStatus.FAILED || 
                current.status === this.predictionStatus.CANCELED) {
                throw new Error(`Prediction ${current.status}: ${current.error || 'Unknown error'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error(`Prediction timeout after ${maxWait}ms`);
    }
    
    // **************************   Utility Methods   **********************************
    
    async testAuth() {
        try {
            await this.getAccount();
            return true;
        } catch (error) {
            if (error.status === 401) {
                return false;
            }
            throw error;
        }
    }
    
    // Helper to format model identifier
    formatModelId(owner, name, version = null) {
        const base = `${owner}/${name}`;
        return version ? `${base}:${version}` : base;
    }
    
    // Helper to parse model identifier
    parseModelId(modelId) {
        const parts = modelId.split(':');
        const [owner, name] = parts[0].split('/');
        const version = parts[1] || null;
        
        return { owner, name, version };
    }
    
    // Helper to stream output from models that support it
    async* streamPrediction(predictionId, options = {}) {
        const interval = options.interval || 100;
        let lastOutputLength = 0;
        
        while (true) {
            const prediction = await this.getPrediction(predictionId);
            
            // Stream new output
            if (prediction.output && Array.isArray(prediction.output)) {
                const newOutput = prediction.output.slice(lastOutputLength);
                for (const item of newOutput) {
                    yield item;
                }
                lastOutputLength = prediction.output.length;
            }
            
            // Check if completed
            if (prediction.status === this.predictionStatus.SUCCEEDED) {
                break;
            }
            
            if (prediction.status === this.predictionStatus.FAILED || 
                prediction.status === this.predictionStatus.CANCELED) {
                throw new Error(`Prediction ${prediction.status}: ${prediction.error || 'Unknown error'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    // Helper for common model types
    async generateText(prompt, options = {}) {
        const model = options.model || 'meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3';
        return this.run(model, {
            prompt: prompt,
            max_new_tokens: options.maxTokens || 500,
            temperature: options.temperature || 0.75,
            top_p: options.topP || 0.9,
            ...options.input
        }, options);
    }
    
    async generateImage(prompt, options = {}) {
        const model = options.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
        return this.run(model, {
            prompt: prompt,
            negative_prompt: options.negativePrompt || '',
            width: options.width || 1024,
            height: options.height || 1024,
            num_outputs: options.numOutputs || 1,
            ...options.input
        }, options);
    }
    
    async transcribeAudio(audioUrl, options = {}) {
        const model = options.model || 'openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2';
        return this.run(model, {
            audio: audioUrl,
            model: options.whisperModel || 'base',
            transcription: options.transcription || 'plain text',
            ...options.input
        }, options);
    }
}

module.exports = { Api };