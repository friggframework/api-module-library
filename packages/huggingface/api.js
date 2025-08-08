const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api-inference.huggingface.co';
        this.hubUrl = 'https://huggingface.co/api';
        
        this.URLs = {
            // Inference endpoints
            models: (modelId) => `/models/${modelId}`,
            
            // Hub API endpoints
            whoami: '/whoami',
            models: '/models',
            datasets: '/datasets',
            spaces: '/spaces',
            
            // Model specific
            modelInfo: (modelId) => `/models/${modelId}`,
            modelTree: (modelId) => `/models/${modelId}/tree/main`,
            
            // Dataset specific
            datasetInfo: (datasetId) => `/datasets/${datasetId}`,
            datasetParquet: (datasetId) => `/datasets/${datasetId}/parquet`,
            
            // Space specific
            spaceInfo: (spaceId) => `/spaces/${spaceId}`,
            
            // Endpoints
            endpoints: '/inference-endpoints',
            endpointById: (endpointId) => `/inference-endpoints/${endpointId}`,
        };
        
        this.taskTypes = {
            // NLP tasks
            'text-generation': { inputType: 'text', outputType: 'text' },
            'text2text-generation': { inputType: 'text', outputType: 'text' },
            'summarization': { inputType: 'text', outputType: 'text' },
            'translation': { inputType: 'text', outputType: 'text' },
            'question-answering': { inputType: 'object', outputType: 'object' },
            'table-question-answering': { inputType: 'object', outputType: 'object' },
            'text-classification': { inputType: 'text', outputType: 'array' },
            'token-classification': { inputType: 'text', outputType: 'array' },
            'fill-mask': { inputType: 'text', outputType: 'array' },
            'zero-shot-classification': { inputType: 'object', outputType: 'array' },
            'feature-extraction': { inputType: 'text', outputType: 'array' },
            'sentence-similarity': { inputType: 'object', outputType: 'array' },
            
            // Vision tasks
            'image-classification': { inputType: 'image', outputType: 'array' },
            'object-detection': { inputType: 'image', outputType: 'array' },
            'image-segmentation': { inputType: 'image', outputType: 'array' },
            'image-to-text': { inputType: 'image', outputType: 'text' },
            'text-to-image': { inputType: 'text', outputType: 'image' },
            
            // Audio tasks
            'automatic-speech-recognition': { inputType: 'audio', outputType: 'text' },
            'audio-classification': { inputType: 'audio', outputType: 'array' },
            'text-to-speech': { inputType: 'text', outputType: 'audio' },
            'audio-to-audio': { inputType: 'audio', outputType: 'audio' },
            
            // Multimodal tasks
            'visual-question-answering': { inputType: 'object', outputType: 'array' },
            'document-question-answering': { inputType: 'object', outputType: 'array' },
            'image-to-image': { inputType: 'image', outputType: 'image' },
        };
    }
    
    async addAuthHeaders(options, isHubApi = false) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.apiKey}`,
        };
        
        if (!isHubApi) {
            options.headers['Content-Type'] = 'application/json';
        }
    }
    
    async _get(options, isHubApi = false) {
        await this.addAuthHeaders(options, isHubApi);
        return super._get(options);
    }
    
    async _post(options, stringify = true, isHubApi = false) {
        await this.addAuthHeaders(options, isHubApi);
        return super._post(options, stringify);
    }
    
    async _put(options, stringify = true, isHubApi = false) {
        await this.addAuthHeaders(options, isHubApi);
        return super._put(options, stringify);
    }
    
    async _delete(options, isHubApi = false) {
        await this.addAuthHeaders(options, isHubApi);
        return super._delete(options);
    }
    
    // **************************   Inference API   **********************************
    
    async inference(modelId, inputs, parameters = {}) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: {
                inputs: inputs,
                parameters: parameters,
                options: {
                    wait_for_model: true,
                }
            },
        };
        
        return this._post(options);
    }
    
    async textGeneration(modelId, inputs, parameters = {}) {
        return this.inference(modelId, inputs, {
            temperature: 0.7,
            max_new_tokens: 100,
            return_full_text: false,
            ...parameters
        });
    }
    
    async textClassification(modelId, inputs) {
        return this.inference(modelId, inputs);
    }
    
    async tokenClassification(modelId, inputs) {
        return this.inference(modelId, inputs);
    }
    
    async questionAnswering(modelId, question, context) {
        return this.inference(modelId, {
            question: question,
            context: context
        });
    }
    
    async summarization(modelId, inputs, parameters = {}) {
        return this.inference(modelId, inputs, {
            max_length: 100,
            min_length: 30,
            ...parameters
        });
    }
    
    async translation(modelId, inputs, parameters = {}) {
        return this.inference(modelId, inputs, parameters);
    }
    
    async fillMask(modelId, inputs) {
        return this.inference(modelId, inputs);
    }
    
    async zeroShotClassification(modelId, inputs, candidateLabels, parameters = {}) {
        return this.inference(modelId, {
            inputs: inputs,
            parameters: {
                candidate_labels: candidateLabels,
                ...parameters
            }
        });
    }
    
    async featureExtraction(modelId, inputs) {
        return this.inference(modelId, inputs);
    }
    
    async sentenceSimilarity(modelId, sourceSentence, sentences) {
        return this.inference(modelId, {
            source_sentence: sourceSentence,
            sentences: sentences
        });
    }
    
    // **************************   Vision Tasks   **********************************
    
    async imageClassification(modelId, image) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: image,
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        };
        
        return this._post(options, false);
    }
    
    async objectDetection(modelId, image) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: image,
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        };
        
        return this._post(options, false);
    }
    
    async imageSegmentation(modelId, image) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: image,
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        };
        
        return this._post(options, false);
    }
    
    async imageToText(modelId, image) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: image,
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        };
        
        return this._post(options, false);
    }
    
    async textToImage(modelId, inputs, parameters = {}) {
        const response = await this.inference(modelId, inputs, {
            negative_prompt: '',
            height: 512,
            width: 512,
            num_inference_steps: 50,
            guidance_scale: 7.5,
            ...parameters
        });
        
        return response;
    }
    
    // **************************   Audio Tasks   **********************************
    
    async automaticSpeechRecognition(modelId, audio) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: audio,
            headers: {
                'Content-Type': 'audio/flac',
            },
        };
        
        return this._post(options, false);
    }
    
    async audioClassification(modelId, audio) {
        const options = {
            url: this.baseUrl + this.URLs.models(modelId),
            body: audio,
            headers: {
                'Content-Type': 'audio/flac',
            },
        };
        
        return this._post(options, false);
    }
    
    async textToSpeech(modelId, inputs) {
        return this.inference(modelId, inputs);
    }
    
    // **************************   Hub API   **********************************
    
    async whoami() {
        const options = {
            url: this.hubUrl + this.URLs.whoami,
        };
        
        return this._get(options, true);
    }
    
    async listModels(params = {}) {
        const options = {
            url: this.hubUrl + this.URLs.models,
            query: params,
        };
        
        return this._get(options, true);
    }
    
    async getModel(modelId) {
        const options = {
            url: this.hubUrl + this.URLs.modelInfo(modelId),
        };
        
        return this._get(options, true);
    }
    
    async getModelFiles(modelId) {
        const options = {
            url: this.hubUrl + this.URLs.modelTree(modelId),
        };
        
        return this._get(options, true);
    }
    
    async listDatasets(params = {}) {
        const options = {
            url: this.hubUrl + this.URLs.datasets,
            query: params,
        };
        
        return this._get(options, true);
    }
    
    async getDataset(datasetId) {
        const options = {
            url: this.hubUrl + this.URLs.datasetInfo(datasetId),
        };
        
        return this._get(options, true);
    }
    
    async getDatasetParquet(datasetId) {
        const options = {
            url: this.hubUrl + this.URLs.datasetParquet(datasetId),
        };
        
        return this._get(options, true);
    }
    
    async listSpaces(params = {}) {
        const options = {
            url: this.hubUrl + this.URLs.spaces,
            query: params,
        };
        
        return this._get(options, true);
    }
    
    async getSpace(spaceId) {
        const options = {
            url: this.hubUrl + this.URLs.spaceInfo(spaceId),
        };
        
        return this._get(options, true);
    }
    
    // **************************   Inference Endpoints   **********************************
    
    async createEndpoint(params) {
        const options = {
            url: this.hubUrl + this.URLs.endpoints,
            body: params,
        };
        
        return this._post(options, true, true);
    }
    
    async listEndpoints() {
        const options = {
            url: this.hubUrl + this.URLs.endpoints,
        };
        
        return this._get(options, true);
    }
    
    async getEndpoint(endpointId) {
        const options = {
            url: this.hubUrl + this.URLs.endpointById(endpointId),
        };
        
        return this._get(options, true);
    }
    
    async updateEndpoint(endpointId, params) {
        const options = {
            url: this.hubUrl + this.URLs.endpointById(endpointId),
            body: params,
        };
        
        return this._put(options, true, true);
    }
    
    async deleteEndpoint(endpointId) {
        const options = {
            url: this.hubUrl + this.URLs.endpointById(endpointId),
        };
        
        return this._delete(options, true);
    }
    
    async pauseEndpoint(endpointId) {
        const options = {
            url: `${this.hubUrl}${this.URLs.endpointById(endpointId)}/pause`,
        };
        
        return this._post(options, true, true);
    }
    
    async resumeEndpoint(endpointId) {
        const options = {
            url: `${this.hubUrl}${this.URLs.endpointById(endpointId)}/resume`,
        };
        
        return this._post(options, true, true);
    }
    
    // **************************   Utility Methods   **********************************
    
    async testAuth() {
        try {
            await this.whoami();
            return true;
        } catch (error) {
            if (error.status === 401) {
                return false;
            }
            throw error;
        }
    }
    
    getTaskInfo(task) {
        return this.taskTypes[task] || {};
    }
    
    // Helper to find models by task
    async findModelsByTask(task, params = {}) {
        const models = await this.listModels({
            filter: task,
            sort: 'downloads',
            direction: -1,
            limit: 10,
            ...params
        });
        
        return models;
    }
    
    // Helper to run any model with automatic task detection
    async runModel(modelId, inputs, parameters = {}) {
        const modelInfo = await this.getModel(modelId);
        const task = modelInfo.pipeline_tag;
        
        if (!task) {
            throw new Error('Could not determine model task type');
        }
        
        const taskInfo = this.getTaskInfo(task);
        
        // Route to appropriate method based on task
        switch (task) {
            case 'text-generation':
                return this.textGeneration(modelId, inputs, parameters);
            case 'text-classification':
                return this.textClassification(modelId, inputs);
            case 'image-classification':
                return this.imageClassification(modelId, inputs);
            case 'automatic-speech-recognition':
                return this.automaticSpeechRecognition(modelId, inputs);
            default:
                return this.inference(modelId, inputs, parameters);
        }
    }
    
    // Helper for embeddings
    async createEmbeddings(modelId, texts) {
        if (typeof texts === 'string') {
            texts = [texts];
        }
        
        const embeddings = [];
        for (const text of texts) {
            const result = await this.featureExtraction(modelId, text);
            embeddings.push(result);
        }
        
        return embeddings;
    }
}

module.exports = { Api };