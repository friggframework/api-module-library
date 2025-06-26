const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.anthropic.com';
        this.anthropicVersion = get(params, 'anthropicVersion', '2023-06-01');
        
        this.URLs = {
            // Messages
            messages: '/v1/messages',
            
            // Completions (Legacy)
            complete: '/v1/complete',
        };
        
        this.modelInfo = {
            'claude-3-opus-20240229': { maxTokens: 200000, outputMax: 4096 },
            'claude-3-sonnet-20240229': { maxTokens: 200000, outputMax: 4096 },
            'claude-3-haiku-20240307': { maxTokens: 200000, outputMax: 4096 },
            'claude-2.1': { maxTokens: 200000, outputMax: 4096 },
            'claude-2.0': { maxTokens: 100000, outputMax: 4096 },
            'claude-instant-1.2': { maxTokens: 100000, outputMax: 4096 },
        };
    }
    
    async addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'x-api-key': this.apiKey,
            'anthropic-version': this.anthropicVersion,
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
    
    // **************************   Messages API   **********************************
    
    async createMessage(params) {
        const options = {
            url: this.baseUrl + this.URLs.messages,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createMessageStream(params) {
        const options = {
            url: this.baseUrl + this.URLs.messages,
            body: { ...params, stream: true },
            headers: {
                'Accept': 'text/event-stream',
            },
        };
        
        // Return the raw response for streaming
        const response = await this._post(options);
        return response;
    }
    
    // **************************   Legacy Completions   **********************************
    
    async createCompletion(params) {
        const options = {
            url: this.baseUrl + this.URLs.complete,
            body: params,
        };
        
        return this._post(options);
    }
    
    async createCompletionStream(params) {
        const options = {
            url: this.baseUrl + this.URLs.complete,
            body: { ...params, stream: true },
            headers: {
                'Accept': 'text/event-stream',
            },
        };
        
        const response = await this._post(options);
        return response;
    }
    
    // **************************   Utility Methods   **********************************
    
    async testAuth() {
        try {
            // Test with a minimal message
            const response = await this.createMessage({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [
                    {
                        role: 'user',
                        content: 'Hi'
                    }
                ]
            });
            return !!response;
        } catch (error) {
            if (error.status === 401) {
                return false;
            }
            throw error;
        }
    }
    
    // Token counting for Claude models
    estimateTokens(text) {
        // Claude uses a similar tokenization to GPT models
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
    
    getModelInfo(model) {
        return this.modelInfo[model] || { maxTokens: 100000, outputMax: 4096 };
    }
    
    getMaxTokens(model) {
        const info = this.getModelInfo(model);
        return info.maxTokens;
    }
    
    getMaxOutputTokens(model) {
        const info = this.getModelInfo(model);
        return info.outputMax;
    }
    
    // Format messages for Claude's expected format
    formatMessages(messages) {
        // Ensure messages alternate between user and assistant
        const formatted = [];
        let lastRole = null;
        
        for (const message of messages) {
            if (message.role === 'system') {
                // Claude doesn't have a system role, prepend to first user message
                if (formatted.length === 0) {
                    formatted.push({
                        role: 'user',
                        content: `${message.content}\n\nUser: `
                    });
                    lastRole = 'user';
                }
            } else if (message.role === lastRole) {
                // Combine consecutive messages from same role
                formatted[formatted.length - 1].content += '\n' + message.content;
            } else {
                formatted.push(message);
                lastRole = message.role;
            }
        }
        
        // Ensure conversation starts with user
        if (formatted.length > 0 && formatted[0].role !== 'user') {
            formatted.unshift({ role: 'user', content: 'Hello' });
        }
        
        // Ensure conversation alternates properly
        const final = [];
        for (let i = 0; i < formatted.length; i++) {
            const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
            if (formatted[i].role !== expectedRole) {
                if (expectedRole === 'user') {
                    final.push({ role: 'user', content: 'Continue' });
                } else {
                    final.push({ role: 'assistant', content: 'I understand.' });
                }
            }
            final.push(formatted[i]);
        }
        
        return final;
    }
    
    // Helper to create a message with proper formatting
    async createFormattedMessage(params) {
        if (params.messages) {
            params.messages = this.formatMessages(params.messages);
        }
        return this.createMessage(params);
    }
    
    // Helper for vision capabilities
    async createVisionMessage(params) {
        // Claude 3 models support vision
        const visionModels = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
        
        if (!visionModels.includes(params.model)) {
            throw new Error(`Model ${params.model} does not support vision. Use one of: ${visionModels.join(', ')}`);
        }
        
        return this.createMessage(params);
    }
    
    // Parse streaming response
    parseStreamChunk(chunk) {
        const lines = chunk.split('\n').filter(line => line.trim());
        const events = [];
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    events.push({ type: 'done' });
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