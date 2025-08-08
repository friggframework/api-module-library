# Cohere API Module

This module provides a complete interface to Cohere's suite of large language models and NLP tools for text generation, embeddings, classification, summarization, and reranking.

## Features

- **Text Generation**: Generate human-like text with Command models
- **Chat Interface**: Conversational AI with streaming support
- **Embeddings**: Create semantic embeddings for search and similarity
- **Classification**: Categorize text into custom classes
- **Summarization**: Extract key points from longer texts
- **Reranking**: Improve search results with semantic reranking
- **Tokenization**: Convert text to and from tokens
- **Fine-tuning**: Customize models for specific use cases
- **Batch Processing**: Efficient handling of large-scale operations

## Authentication

Cohere uses API key authentication. You'll need to:

1. Sign up at [dashboard.cohere.ai](https://dashboard.cohere.ai)
2. Generate an API key from your dashboard
3. Set the following environment variable:

```bash
COHERE_API_KEY=your_api_key_here
```

## Usage Examples

### Text Generation

```javascript
const {Api} = require('./api');

const api = new Api({
    apiKey: process.env.COHERE_API_KEY
});

// Generate text
const response = await api.generate({
    model: 'command',
    prompt: 'Write a brief introduction to machine learning',
    max_tokens: 200,
    temperature: 0.7
});

// Stream generation
const stream = await api.generateStream({
    model: 'command-nightly',
    prompt: 'Tell me a story about space exploration',
    max_tokens: 500,
    stream: true
});
```

### Chat Interface

```javascript
// Simple chat
const chatResponse = await api.chat({
    model: 'command',
    message: 'What are the benefits of renewable energy?',
    temperature: 0.5
});

// Chat with conversation history
const conversation = await api.chat({
    model: 'command',
    message: 'What about solar specifically?',
    chat_history: [
        {role: 'USER', message: 'What are the benefits of renewable energy?'},
        {role: 'CHATBOT', message: 'Renewable energy offers several benefits...'}
    ]
});

// Streaming chat
const chatStream = await api.chatStream({
    model: 'command',
    message: 'Explain quantum computing',
    stream: true
});
```

### Embeddings

```javascript
// Create embeddings
const embeddings = await api.embed({
    texts: [
        'Machine learning is a subset of AI',
        'Deep learning uses neural networks',
        'Natural language processing handles text'
    ],
    model: 'embed-english-v3.0',
    input_type: 'search_document'
});

// Semantic search
const searchResults = await api.semanticSearch(
    'What is artificial intelligence?',
    [
        'AI is the simulation of human intelligence',
        'Machine learning enables computers to learn',
        'Robotics involves creating intelligent machines'
    ],
    'embed-english-v3.0',
    topK=2
);
```

### Classification

```javascript
// Classify text
const classification = await api.classify({
    inputs: ['This product is amazing!', 'Terrible experience, would not recommend'],
    examples: [
        {text: 'I love this!', label: 'positive'},
        {text: 'This is bad', label: 'negative'},
        {text: 'It works well', label: 'positive'},
        {text: 'Disappointed', label: 'negative'}
    ],
    model: 'embed-english-v3.0'
});
```

### Summarization

```javascript
const summary = await api.summarize({
    text: 'Long article text here...',
    length: 'medium',
    format: 'bullets',
    model: 'command',
    additional_command: 'Focus on key findings',
    temperature: 0.3
});
```

### Reranking

```javascript
// Rerank search results
const reranked = await api.rerank({
    model: 'rerank-english-v2.0',
    query: 'What is machine learning?',
    documents: [
        'Machine learning is a method of data analysis',
        'Python is a programming language',
        'ML algorithms learn from data',
        'Databases store information'
    ],
    top_n: 2
});
```

### Tokenization

```javascript
// Tokenize text
const tokens = await api.tokenize({
    text: 'Hello, world!',
    model: 'command'
});

// Detokenize
const text = await api.detokenize({
    tokens: [2016, 1010, 2088, 999],
    model: 'command'
});
```

### Fine-tuning

```javascript
// Create dataset
const dataset = await api.createDataset({
    name: 'customer-support',
    type: 'classification',
    data: [
        {text: 'How do I reset my password?', label: 'account'},
        {text: 'When will my order arrive?', label: 'shipping'}
    ]
});

// Create fine-tuning job
const fineTune = await api.createFineTune({
    model: 'embed-english-v3.0',
    dataset_id: dataset.id,
    hyperparameters: {
        learning_rate: 0.001,
        num_epochs: 3
    }
});

// Check status
const status = await api.getFineTune(fineTune.id);
```

### Batch Processing

```javascript
// Batch embed large document set
const documents = ['doc1', 'doc2', ...]; // thousands of documents
const batchEmbeddings = await api.batchEmbed(
    documents,
    'embed-english-v3.0',
    96  // batch size
);
```

## Available Models

### Generation Models
- **command**: Production-ready text generation
- **command-light**: Faster, lighter version
- **command-nightly**: Latest features (experimental)
- **command-light-nightly**: Light version with latest features

### Embedding Models
- **embed-english-v3.0**: English embeddings (1024 dimensions)
- **embed-multilingual-v3.0**: Multilingual embeddings (1024 dimensions)
- **embed-english-light-v3.0**: Lightweight English (384 dimensions)
- **embed-multilingual-light-v3.0**: Lightweight multilingual (384 dimensions)

### Rerank Models
- **rerank-english-v2.0**: English reranking
- **rerank-multilingual-v2.0**: Multilingual reranking

## API Methods

### Generation
- `generate(params)` - Generate text from prompt
- `generateStream(params)` - Stream text generation
- `chat(params)` - Chat conversation interface
- `chatStream(params)` - Stream chat responses

### Embeddings
- `embed(params)` - Create text embeddings
- `embedJobs(params)` - Large batch embedding jobs
- `batchEmbed(texts, model, batchSize)` - Helper for batch processing
- `semanticSearch(query, documents, model, topK)` - Semantic search helper

### Analysis
- `classify(params)` - Classify text into categories
- `summarize(params)` - Summarize long texts
- `rerank(params)` - Rerank documents by relevance

### Tokenization
- `tokenize(params)` - Convert text to tokens
- `detokenize(params)` - Convert tokens to text

### Models & Datasets
- `listModels()` - List available models
- `getModel(modelId)` - Get model details
- `createDataset(params)` - Create training dataset
- `listDatasets(params)` - List datasets
- `getDataset(datasetId)` - Get dataset details
- `deleteDataset(datasetId)` - Delete dataset

### Fine-tuning
- `createFineTune(params)` - Start fine-tuning job
- `listFineTunes(params)` - List fine-tuning jobs
- `getFineTune(fineTuneId)` - Get job details
- `updateFineTune(fineTuneId, params)` - Update job
- `deleteFineTune(fineTuneId)` - Delete job

### Utilities
- `testAuth()` - Verify API key
- `getModelInfo(model)` - Get model specifications
- `cosineSimilarity(a, b)` - Calculate embedding similarity
- `parseStreamChunk(chunk)` - Parse streaming responses

## Best Practices

1. **Choose the Right Model**: Use Command for generation, specialized models for embeddings/rerank
2. **Batch Operations**: Use batch methods for processing multiple items efficiently
3. **Input Types**: Specify correct `input_type` for embeddings (search_query vs search_document)
4. **Temperature Control**: Lower temperature (0-0.3) for factual, higher (0.7-1) for creative
5. **Token Limits**: Be aware of model token limits when processing long texts

## Error Handling

Common errors:
- `401`: Invalid API key
- `429`: Rate limit exceeded
- `400`: Invalid parameters
- `413`: Request too large

## Support

For more information, visit [Cohere Documentation](https://docs.cohere.com).