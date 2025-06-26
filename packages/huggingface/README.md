# Hugging Face API Module

This module provides comprehensive access to Hugging Face's model hub, inference API, datasets, and spaces for machine learning applications.

## Features

- **Model Hub Access**: Browse and use thousands of pre-trained models
- **Inference API**: Run models for various ML tasks without infrastructure
- **Datasets**: Access and query ML datasets
- **Spaces**: Interact with ML demo applications
- **Inference Endpoints**: Deploy and manage dedicated model endpoints
- **Multi-Modal Support**: Text, vision, audio, and multimodal models
- **Task Auto-Detection**: Automatically route to appropriate inference method

## Authentication

Hugging Face uses API tokens for authentication. You'll need to:

1. Sign up at [huggingface.co](https://huggingface.co)
2. Generate an API token from your [settings](https://huggingface.co/settings/tokens)
3. Set the following environment variable:

```bash
HUGGINGFACE_API_TOKEN=your_token_here
# or
HUGGINGFACE_API_KEY=your_token_here
```

## Usage Examples

### Text Generation

```javascript
const {Api} = require('./api');

const api = new Api({
    apiKey: process.env.HUGGINGFACE_API_TOKEN
});

// Generate text with specific model
const response = await api.textGeneration(
    'meta-llama/Llama-2-7b-chat-hf',
    'Tell me about machine learning',
    {
        max_new_tokens: 200,
        temperature: 0.7,
        top_p: 0.95
    }
);

// Or use generic inference
const result = await api.inference(
    'gpt2',
    'Once upon a time',
    { max_length: 50 }
);
```

### Text Classification

```javascript
// Sentiment analysis
const sentiment = await api.textClassification(
    'distilbert-base-uncased-finetuned-sst-2-english',
    'I love this product! It works great.'
);

// Zero-shot classification
const categories = await api.zeroShotClassification(
    'facebook/bart-large-mnli',
    'I need to book a flight to Paris',
    ['travel', 'food', 'technology', 'sports']
);
```

### Question Answering

```javascript
const answer = await api.questionAnswering(
    'distilbert-base-cased-distilled-squad',
    'What is the capital of France?',
    'France is a country in Europe. Its capital is Paris, which is known for the Eiffel Tower.'
);
```

### Summarization

```javascript
const summary = await api.summarization(
    'facebook/bart-large-cnn',
    'Long article text here...',
    {
        max_length: 130,
        min_length: 30,
        do_sample: false
    }
);
```

### Translation

```javascript
const translated = await api.translation(
    'Helsinki-NLP/opus-mt-en-es',
    'Hello, how are you today?'
);
```

### Image Classification

```javascript
// Read image file
const imageBuffer = fs.readFileSync('image.jpg');

const classification = await api.imageClassification(
    'google/vit-base-patch16-224',
    imageBuffer
);
```

### Object Detection

```javascript
const objects = await api.objectDetection(
    'facebook/detr-resnet-50',
    imageBuffer
);

// Returns bounding boxes with labels and scores
```

### Image Generation

```javascript
const image = await api.textToImage(
    'stabilityai/stable-diffusion-2-1',
    'A beautiful sunset over mountains',
    {
        negative_prompt: 'blurry, bad quality',
        height: 512,
        width: 512,
        num_inference_steps: 50,
        guidance_scale: 7.5
    }
);
```

### Speech Recognition

```javascript
const audioBuffer = fs.readFileSync('speech.wav');

const transcription = await api.automaticSpeechRecognition(
    'openai/whisper-base',
    audioBuffer
);
```

### Feature Extraction (Embeddings)

```javascript
// Single text embedding
const embedding = await api.featureExtraction(
    'sentence-transformers/all-MiniLM-L6-v2',
    'This is a sample sentence'
);

// Multiple embeddings
const embeddings = await api.createEmbeddings(
    'sentence-transformers/all-MiniLM-L6-v2',
    ['First sentence', 'Second sentence', 'Third sentence']
);
```

### Model Hub Operations

```javascript
// Get user info
const user = await api.whoami();

// List models
const models = await api.listModels({
    filter: 'text-generation',
    sort: 'downloads',
    direction: -1,
    limit: 10
});

// Get specific model info
const modelInfo = await api.getModel('bert-base-uncased');

// Get model files
const files = await api.getModelFiles('bert-base-uncased');

// Find models by task
const textGenModels = await api.findModelsByTask('text-generation', {
    limit: 5
});
```

### Datasets

```javascript
// List datasets
const datasets = await api.listDatasets({
    filter: 'task_categories:text-classification',
    sort: 'downloads',
    limit: 10
});

// Get dataset info
const datasetInfo = await api.getDataset('imdb');

// Get dataset parquet files
const parquetInfo = await api.getDatasetParquet('imdb');
```

### Spaces

```javascript
// List spaces
const spaces = await api.listSpaces({
    filter: 'sdk:gradio',
    sort: 'likes',
    limit: 10
});

// Get space info
const spaceInfo = await api.getSpace('openai/whisper');
```

### Inference Endpoints

```javascript
// Create dedicated endpoint
const endpoint = await api.createEndpoint({
    model: 'bert-base-uncased',
    name: 'my-bert-endpoint',
    provider: 'aws',
    region: 'us-east-1',
    type: 'protected',
    hardware: {
        accelerator: 'gpu',
        instanceType: 'g4dn.xlarge',
        instanceSize: 'xlarge'
    }
});

// List endpoints
const endpoints = await api.listEndpoints();

// Manage endpoint
await api.pauseEndpoint(endpoint.id);
await api.resumeEndpoint(endpoint.id);
await api.deleteEndpoint(endpoint.id);
```

### Auto-Model Detection

```javascript
// Automatically detect task and run appropriate method
const result = await api.runModel(
    'distilbert-base-uncased-finetuned-sst-2-english',
    'This movie was fantastic!',
    {} // optional parameters
);
```

## Supported Tasks

### NLP Tasks
- Text Generation
- Text-to-Text Generation
- Summarization
- Translation
- Question Answering
- Table Question Answering
- Text Classification
- Token Classification
- Fill-Mask
- Zero-Shot Classification
- Feature Extraction
- Sentence Similarity

### Vision Tasks
- Image Classification
- Object Detection
- Image Segmentation
- Image-to-Text
- Text-to-Image

### Audio Tasks
- Automatic Speech Recognition
- Audio Classification
- Text-to-Speech
- Audio-to-Audio

### Multimodal Tasks
- Visual Question Answering
- Document Question Answering
- Image-to-Image

## API Methods

### Inference Methods
- `inference(modelId, inputs, parameters)` - Generic inference
- `textGeneration(modelId, inputs, parameters)` - Generate text
- `textClassification(modelId, inputs)` - Classify text
- `tokenClassification(modelId, inputs)` - Token-level classification
- `questionAnswering(modelId, question, context)` - Answer questions
- `summarization(modelId, inputs, parameters)` - Summarize text
- `translation(modelId, inputs, parameters)` - Translate text
- `fillMask(modelId, inputs)` - Fill masked tokens
- `zeroShotClassification(modelId, inputs, candidateLabels, parameters)` - Zero-shot classify
- `featureExtraction(modelId, inputs)` - Extract features/embeddings
- `sentenceSimilarity(modelId, sourceSentence, sentences)` - Compare sentences

### Vision Methods
- `imageClassification(modelId, image)` - Classify images
- `objectDetection(modelId, image)` - Detect objects
- `imageSegmentation(modelId, image)` - Segment images
- `imageToText(modelId, image)` - Caption images
- `textToImage(modelId, inputs, parameters)` - Generate images

### Audio Methods
- `automaticSpeechRecognition(modelId, audio)` - Transcribe audio
- `audioClassification(modelId, audio)` - Classify audio
- `textToSpeech(modelId, inputs)` - Generate speech

### Hub API Methods
- `whoami()` - Get user information
- `listModels(params)` - List available models
- `getModel(modelId)` - Get model details
- `getModelFiles(modelId)` - List model files
- `listDatasets(params)` - List datasets
- `getDataset(datasetId)` - Get dataset info
- `getDatasetParquet(datasetId)` - Get dataset parquet info
- `listSpaces(params)` - List spaces
- `getSpace(spaceId)` - Get space info

### Endpoint Methods
- `createEndpoint(params)` - Create inference endpoint
- `listEndpoints()` - List endpoints
- `getEndpoint(endpointId)` - Get endpoint details
- `updateEndpoint(endpointId, params)` - Update endpoint
- `deleteEndpoint(endpointId)` - Delete endpoint
- `pauseEndpoint(endpointId)` - Pause endpoint
- `resumeEndpoint(endpointId)` - Resume endpoint

### Utilities
- `testAuth()` - Verify API token
- `getTaskInfo(task)` - Get task information
- `findModelsByTask(task, params)` - Find models for task
- `runModel(modelId, inputs, parameters)` - Auto-detect and run model
- `createEmbeddings(modelId, texts)` - Batch create embeddings

## Best Practices

1. **Model Selection**: Choose models based on your specific task and performance needs
2. **Rate Limiting**: Be aware of rate limits on the free tier
3. **Model Loading**: First requests may be slow as models load (`wait_for_model: true`)
4. **Input Formats**: Ensure correct input format for each task type
5. **Error Handling**: Handle model loading timeouts and rate limit errors

## Error Handling

Common errors:
- `401`: Invalid API token
- `429`: Rate limit exceeded
- `503`: Model is loading (retry after delay)
- `400`: Invalid input format

## Support

For more information, visit [Hugging Face Documentation](https://huggingface.co/docs).