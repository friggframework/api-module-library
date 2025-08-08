const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.openai.com/v1';
        this.organizationId = get(params, 'organizationId', null);
        
        this.URLs = {
            // Chat Completions
            chatCompletions: '/chat/completions',
            
            // Completions (Legacy)
            completions: '/completions',
            
            // Embeddings
            embeddings: '/embeddings',
            
            // Images
            imagesGenerations: '/images/generations',
            imagesEdits: '/images/edits',
            imagesVariations: '/images/variations',
            
            // Audio
            audioTranscriptions: '/audio/transcriptions',
            audioTranslations: '/audio/translations',
            audioSpeech: '/audio/speech',
            
            // Files
            files: '/files',
            fileById: (fileId) => `/files/${fileId}`,
            fileContent: (fileId) => `/files/${fileId}/content`,
            
            // Fine-tuning
            fineTuningJobs: '/fine_tuning/jobs',
            fineTuningJobById: (jobId) => `/fine_tuning/jobs/${jobId}`,
            fineTuningEvents: (jobId) => `/fine_tuning/jobs/${jobId}/events`,
            fineTuningCancel: (jobId) => `/fine_tuning/jobs/${jobId}/cancel`,
            
            // Models
            models: '/models',
            modelById: (modelId) => `/models/${modelId}`,
            
            // Assistants
            assistants: '/assistants',
            assistantById: (assistantId) => `/assistants/${assistantId}`,
            
            // Threads
            threads: '/threads',
            threadById: (threadId) => `/threads/${threadId}`,
            threadMessages: (threadId) => `/threads/${threadId}/messages`,
            threadRuns: (threadId) => `/threads/${threadId}/runs`,
            
            // Moderations
            moderations: '/moderations',
        };
        
        this.tokenLimits = {
            'gpt-4': 8192,
            'gpt-4-32k': 32768,
            'gpt-4-1106-preview': 128000,
            'gpt-3.5-turbo': 4096,
            'gpt-3.5-turbo-16k': 16385,
            'text-embedding-ada-002': 8191,
        };
    }
    
    async addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v1',
        };
        
        if (this.organizationId) {
            options.headers['OpenAI-Organization'] = this.organizationId;
        }
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
    
    // **************************   Chat Completions   **********************************
    
    async createChatCompletion(params) {
        const options = {
            url: this.baseUrl + this.URLs.chatCompletions,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createChatCompletionStream(params) {
        const options = {
            url: this.baseUrl + this.URLs.chatCompletions,
            body: { ...params, stream: true },
            headers: {
                'Accept': 'text/event-stream',
            },
        };
        
        // Return the raw response for streaming
        const response = await this._post(options);
        return response;
    }
    
    // **************************   Embeddings   **********************************
    
    async createEmbedding(params) {
        const options = {
            url: this.baseUrl + this.URLs.embeddings,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Images   **********************************
    
    async createImage(params) {
        const options = {
            url: this.baseUrl + this.URLs.imagesGenerations,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createImageEdit(params) {
        const options = {
            url: this.baseUrl + this.URLs.imagesEdits,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createImageVariation(params) {
        const options = {
            url: this.baseUrl + this.URLs.imagesVariations,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Audio   **********************************
    
    async createTranscription(params) {
        const options = {
            url: this.baseUrl + this.URLs.audioTranscriptions,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createTranslation(params) {
        const options = {
            url: this.baseUrl + this.URLs.audioTranslations,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createSpeech(params) {
        const options = {
            url: this.baseUrl + this.URLs.audioSpeech,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Files   **********************************
    
    async uploadFile(params) {
        const options = {
            url: this.baseUrl + this.URLs.files,
            body: params,
        };
        
        return this._post(options);
    }
    
    async listFiles(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.files,
            query: params,
        };
        
        return this._get(options);
    }
    
    async retrieveFile(fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileById(fileId),
        };
        
        return this._get(options);
    }
    
    async deleteFile(fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileById(fileId),
        };
        
        return this._delete(options);
    }
    
    async retrieveFileContent(fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileContent(fileId),
        };
        
        return this._get(options);
    }
    
    // **************************   Fine-tuning   **********************************
    
    async createFineTuningJob(params) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuningJobs,
            body: params,
        };
        
        return this._post(options);
    }
    
    async listFineTuningJobs(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuningJobs,
            query: params,
        };
        
        return this._get(options);
    }
    
    async retrieveFineTuningJob(jobId) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuningJobById(jobId),
        };
        
        return this._get(options);
    }
    
    async cancelFineTuningJob(jobId) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuningCancel(jobId),
        };
        
        return this._post(options);
    }
    
    async listFineTuningEvents(jobId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.fineTuningEvents(jobId),
            query: params,
        };
        
        return this._get(options);
    }
    
    // **************************   Models   **********************************
    
    async listModels() {
        const options = {
            url: this.baseUrl + this.URLs.models,
        };
        
        return this._get(options);
    }
    
    async retrieveModel(modelId) {
        const options = {
            url: this.baseUrl + this.URLs.modelById(modelId),
        };
        
        return this._get(options);
    }
    
    async deleteModel(modelId) {
        const options = {
            url: this.baseUrl + this.URLs.modelById(modelId),
        };
        
        return this._delete(options);
    }
    
    // **************************   Assistants   **********************************
    
    async createAssistant(params) {
        const options = {
            url: this.baseUrl + this.URLs.assistants,
            body: params,
        };
        
        return this._post(options);
    }
    
    async listAssistants(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.assistants,
            query: params,
        };
        
        return this._get(options);
    }
    
    async retrieveAssistant(assistantId) {
        const options = {
            url: this.baseUrl + this.URLs.assistantById(assistantId),
        };
        
        return this._get(options);
    }
    
    async modifyAssistant(assistantId, params) {
        const options = {
            url: this.baseUrl + this.URLs.assistantById(assistantId),
            body: params,
        };
        
        return this._post(options);
    }
    
    async deleteAssistant(assistantId) {
        const options = {
            url: this.baseUrl + this.URLs.assistantById(assistantId),
        };
        
        return this._delete(options);
    }
    
    // **************************   Threads   **********************************
    
    async createThread(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.threads,
            body: params,
        };
        
        return this._post(options);
    }
    
    async retrieveThread(threadId) {
        const options = {
            url: this.baseUrl + this.URLs.threadById(threadId),
        };
        
        return this._get(options);
    }
    
    async modifyThread(threadId, params) {
        const options = {
            url: this.baseUrl + this.URLs.threadById(threadId),
            body: params,
        };
        
        return this._post(options);
    }
    
    async deleteThread(threadId) {
        const options = {
            url: this.baseUrl + this.URLs.threadById(threadId),
        };
        
        return this._delete(options);
    }
    
    async createMessage(threadId, params) {
        const options = {
            url: this.baseUrl + this.URLs.threadMessages(threadId),
            body: params,
        };
        
        return this._post(options);
    }
    
    async listMessages(threadId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.threadMessages(threadId),
            query: params,
        };
        
        return this._get(options);
    }
    
    async createRun(threadId, params) {
        const options = {
            url: this.baseUrl + this.URLs.threadRuns(threadId),
            body: params,
        };
        
        return this._post(options);
    }
    
    async listRuns(threadId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.threadRuns(threadId),
            query: params,
        };
        
        return this._get(options);
    }
    
    // **************************   Moderations   **********************************
    
    async createModeration(params) {
        const options = {
            url: this.baseUrl + this.URLs.moderations,
            body: params,
        };
        
        return this._post(options);
    }
    
    // **************************   Utility Methods   **********************************
    
    async testAuth() {
        try {
            await this.listModels();
            return true;
        } catch (error) {
            return false;
        }
    }
    
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
    
    getTokenLimit(model) {
        return this.tokenLimits[model] || 4096;
    }
}

module.exports = { Api };