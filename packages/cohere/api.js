const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.cohere.ai/v1';
        
        this.URLs = {
            // Generation
            generate: '/generate',
            chat: '/chat',
            
            // Embeddings
            embed: '/embed',
            
            // Classification
            classify: '/classify',
            
            // Summarization
            summarize: '/summarize',
            
            // Reranking
            rerank: '/rerank',
            
            // Tokenization
            tokenize: '/tokenize',
            detokenize: '/detokenize',
            
            // Models
            models: '/models',
            modelById: (modelId) => `/models/${modelId}`,
            
            // Datasets
            datasets: '/datasets',
            datasetById: (datasetId) => `/datasets/${datasetId}`,
            
            // Fine-tuning
            fineTunes: '/fine-tunes',
            fineTuneById: (fineTuneId) => `/fine-tunes/${fineTuneId}`,
        };
        
        this.modelInfo = {
            // Command models
            'command': { maxTokens: 4096 },
            'command-light': { maxTokens: 4096 },
            'command-nightly': { maxTokens: 4096 },
            'command-light-nightly': { maxTokens: 4096 },
            
            // Embedding models
            'embed-english-v3.0': { dimensions: 1024 },
            'embed-multilingual-v3.0': { dimensions: 1024 },
            'embed-english-light-v3.0': { dimensions: 384 },
            'embed-multilingual-light-v3.0': { dimensions: 384 },
            
            // Rerank models
            'rerank-english-v2.0': {},
            'rerank-multilingual-v2.0': {},
        };
    }
    
    async addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
    
    // **************************   Generation   **********************************
    
    async generate(params) {
        const options = {
            url: this.baseUrl + this.URLs.generate,
            body: params,
        };
        
        return this._post(options);
    }
    
    async generateStream(params) {
        const options = {
            url: this.baseUrl + this.URLs.generate,
            body: { ...params, stream: true },
            headers: {
                'Accept': 'text/event-stream',
            },
        };
        
        return this._post(options);
    }
    
    // **************************   Chat   **********************************
    
    async chat(params) {
        const options = {
            url: this.baseUrl + this.URLs.chat,
            body: params,
        };
        
        return this._post(options);
    }
    
    async chatStream(params) {
        const options = {
            url: this.baseUrl + this.URLs.chat,
            body: { ...params, stream: true },
            headers: {
                'Accept': 'text/event-stream',
            },
        };
        
        return this._post(options);
    }
    
    // **************************   Embeddings   **********************************
    
    async embed(params) {
        const options = {
            url: this.baseUrl + this.URLs.embed,
            body: params,
        };
        
        return this._post(options);
    }
    
    async embedJobs(params) {
        // For large batch embeddings
        const options = {
            url: this.baseUrl + '/embed-jobs',
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Classification   **********************************
    
    async classify(params) {
        const options = {
            url: this.baseUrl + this.URLs.classify,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Summarization   **********************************
    
    async summarize(params) {
        const options = {
            url: this.baseUrl + this.URLs.summarize,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Reranking   **********************************
    
    async rerank(params) {
        const options = {
            url: this.baseUrl + this.URLs.rerank,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Tokenization   **********************************
    
    async tokenize(params) {
        const options = {
            url: this.baseUrl + this.URLs.tokenize,
            body: params,
        };
        
        return this._post(options);
    }
    
    async detokenize(params) {
        const options = {
            url: this.baseUrl + this.URLs.detokenize,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Models   **********************************
    
    async listModels() {
        const options = {
            url: this.baseUrl + this.URLs.models,
        };
        
        return this._get(options);
    }
    
    async getModel(modelId) {
        const options = {
            url: this.baseUrl + this.URLs.modelById(modelId),
        };
        
        return this._get(options);
    }
    
    // **************************   Datasets   **********************************
    
    async createDataset(params) {
        const options = {
            url: this.baseUrl + this.URLs.datasets,
            body: params,
        };
        
        return this._post(options);
    }
    
    async listDatasets(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.datasets,
            query: params,
        };
        
        return this._get(options);
    }
    
    async getDataset(datasetId) {
        const options = {
            url: this.baseUrl + this.URLs.datasetById(datasetId),
        };
        
        return this._get(options);
    }
    
    async deleteDataset(datasetId) {
        const options = {
            url: this.baseUrl + this.URLs.datasetById(datasetId),
        };
        
        return this._delete(options);
    }
    
    // **************************   Fine-tuning   **********************************
    
    async createFineTune(params) {
        const options = {
            url: this.baseUrl + this.URLs.fineTunes,
            body: params,
        };
        
        return this._post(options);
    }
    
    async listFineTunes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.fineTunes,
            query: params,
        };
        
        return this._get(options);
    }
    
    async getFineTune(fineTuneId) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuneById(fineTuneId),
        };
        
        return this._get(options);
    }
    
    async updateFineTune(fineTuneId, params) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuneById(fineTuneId),
            body: params,
        };
        
        return this._patch(options);
    }
    
    async deleteFineTune(fineTuneId) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuneById(fineTuneId),
        };
        
        return this._delete(options);
    }
    
    // **************************   Utility Methods   **********************************
    
    async testAuth() {
        try {
            await this.listModels();
            return true;
        } catch (error) {
            if (error.status === 401) {
                return false;
            }
            throw error;
        }
    }
    
    // Batch processing utilities
    async batchEmbed(texts, model = 'embed-english-v3.0', batchSize = 96) {
        const batches = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            batches.push(texts.slice(i, i + batchSize));
        }
        
        const results = [];
        for (const batch of batches) {
            const response = await this.embed({
                texts: batch,
                model: model,
                input_type: 'search_document'
            });
            results.push(...response.embeddings);
        }
        
        return results;
    }
    
    // Helper for semantic search
    async semanticSearch(query, documents, model = 'embed-english-v3.0', topK = 10) {
        // Embed query
        const queryResponse = await this.embed({
            texts: [query],
            model: model,
            input_type: 'search_query'
        });
        const queryEmbedding = queryResponse.embeddings[0];
        
        // Embed documents
        const docsResponse = await this.embed({
            texts: documents,
            model: model,
            input_type: 'search_document'
        });
        
        // Calculate similarities
        const similarities = docsResponse.embeddings.map((docEmb, idx) => ({
            index: idx,
            similarity: this.cosineSimilarity(queryEmbedding, docEmb),
            text: documents[idx]
        }));
        
        // Sort and return top K
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }
    
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    
    getModelInfo(model) {
        return this.modelInfo[model] || {};
    }
    
    // Parse streaming response
    parseStreamChunk(chunk) {
        const lines = chunk.split('\n').filter(line => line.trim());
        const events = [];
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    events.push({ event_type: 'stream-end' });
                } else {
                    try {
                        events.push(JSON.parse(data));
                    } catch (e) {
                        console.error('Failed to parse stream chunk:', e);
                    }
                }
            }
        }
        
        return events;
    }
}

module.exports = { Api };