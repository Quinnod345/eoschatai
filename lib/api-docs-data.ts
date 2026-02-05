// Comprehensive API documentation data for EOSAI

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  enum?: string[];
}

export interface ApiRequestBody {
  contentType: string;
  schema: Record<string, unknown>;
  example: Record<string, unknown>;
}

export interface ApiResponse {
  status: number;
  description: string;
  example: Record<string, unknown>;
}

export interface CodeExamples {
  curl: string;
  javascript: string;
  python: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  path: string;
  summary: string;
  description: string;
  badge?: string;
  pathParameters?: ApiParameter[];
  queryParameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  codeExamples: CodeExamples;
}

export interface ApiCategory {
  id: string;
  title: string;
  description: string;
  endpoints: ApiEndpoint[];
}

export const apiCategories: ApiCategory[] = [
  {
    id: 'chat',
    title: 'Chat Completions',
    description:
      'Generate AI responses with EOS methodology knowledge built-in.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/chat',
        summary: 'Create chat completion',
        description:
          'Generate an AI response to a conversation powered by Claude. Supports both streaming and non-streaming responses with EOS methodology knowledge built-in.',
        badge: 'Core',
        requestBody: {
          contentType: 'application/json',
          schema: {
            messages: 'array of message objects (required)',
            model: 'string (default: eosai-v1)',
            stream: 'boolean (default: false)',
            temperature: 'number 0-2 (default: 0.7)',
            max_tokens: 'integer 1-16384 (default: 4096)',
            include_eos_context: 'boolean (default: true)',
            eos_namespace: 'string (default: eos-implementer)',
          },
          example: {
            messages: [
              { role: 'user', content: 'What is a Level 10 Meeting?' },
            ],
            model: 'eosai-v1',
            stream: false,
            include_eos_context: true,
          },
        },
        responses: [
          {
            status: 200,
            description: 'Successful completion',
            example: {
              id: 'eosai-abc123',
              object: 'chat.completion',
              created: 1707048000,
              model: 'eosai-v1',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content:
                      'A Level 10 Meeting is a weekly 90-minute meeting that follows a specific agenda designed to keep your leadership team aligned, accountable, and solving issues effectively...',
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 15,
                completion_tokens: 250,
                total_tokens: 265,
              },
            },
          },
        ],
        codeExamples: {
          curl: `# Non-streaming request
curl -X POST https://eosbot.ai/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "What is a Level 10 Meeting?"}
    ],
    "model": "eosai-v1"
  }'

# Streaming request
curl -X POST https://eosbot.ai/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -N \\
  -d '{
    "messages": [
      {"role": "user", "content": "What is a Level 10 Meeting?"}
    ],
    "model": "eosai-v1",
    "stream": true
  }'`,
          javascript: `// Non-streaming request
const response = await fetch('https://eosbot.ai/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'What is a Level 10 Meeting?' }],
    model: 'eosai-v1',
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);

// Streaming request
const streamResponse = await fetch('https://eosbot.ai/api/v1/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'What is a Level 10 Meeting?' }],
    model: 'eosai-v1',
    stream: true,
  }),
});

const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));
  
  for (const line of lines) {
    const data = line.slice(6);
    if (data === '[DONE]') continue;
    
    const parsed = JSON.parse(data);
    const content = parsed.choices[0]?.delta?.content;
    if (content) process.stdout.write(content);
  }
}`,
          python: `import requests

# Non-streaming request
response = requests.post(
    'https://eosbot.ai/api/v1/chat',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'messages': [{'role': 'user', 'content': 'What is a Level 10 Meeting?'}],
        'model': 'eosai-v1',
    }
)
data = response.json()
print(data['choices'][0]['message']['content'])

# Streaming request
import json

response = requests.post(
    'https://eosbot.ai/api/v1/chat',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'messages': [{'role': 'user', 'content': 'What is a Level 10 Meeting?'}],
        'model': 'eosai-v1',
        'stream': True,
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data == '[DONE]':
                break
            parsed = json.loads(data)
            content = parsed.get('choices', [{}])[0].get('delta', {}).get('content', '')
            if content:
                print(content, end='', flush=True)`,
        },
      },
    ],
  },
  {
    id: 'conversations',
    title: 'Conversations',
    description:
      'Persistent multi-turn conversations with automatic history management.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/conversations',
        summary: 'Create conversation',
        description:
          'Create a new persistent conversation. Conversations maintain message history and can be used for multi-turn interactions without sending full history each time.',
        badge: 'New',
        requestBody: {
          contentType: 'application/json',
          schema: {
            title: 'string (optional, max 256 chars)',
            model: 'string (default: eosai-v1)',
            system_prompt: 'string (optional, max 4096 chars)',
            metadata: 'object (optional)',
          },
          example: {
            title: 'EOS Implementation Questions',
            model: 'eosai-v1',
            system_prompt:
              'You are an EOS expert helping with quarterly planning.',
          },
        },
        responses: [
          {
            status: 201,
            description: 'Conversation created',
            example: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              object: 'conversation',
              title: 'EOS Implementation Questions',
              model: 'eosai-v1',
              system_prompt:
                'You are an EOS expert helping with quarterly planning.',
              metadata: null,
              message_count: 0,
              total_tokens: 0,
              created_at: '2026-02-04T12:00:00.000Z',
              updated_at: '2026-02-04T12:00:00.000Z',
            },
          },
        ],
        codeExamples: {
          curl: `curl -X POST https://eosbot.ai/api/v1/conversations \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "EOS Implementation Questions",
    "model": "eosai-v1"
  }'`,
          javascript: `const response = await fetch('https://eosbot.ai/api/v1/conversations', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'EOS Implementation Questions',
    model: 'eosai-v1',
  }),
});

const conversation = await response.json();
console.log('Created conversation:', conversation.id);`,
          python: `import requests

response = requests.post(
    'https://eosbot.ai/api/v1/conversations',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'title': 'EOS Implementation Questions',
        'model': 'eosai-v1',
    }
)

conversation = response.json()
print(f"Created conversation: {conversation['id']}")`,
        },
      },
      {
        method: 'GET',
        path: '/v1/conversations',
        summary: 'List conversations',
        description:
          'Returns a list of all conversations for the current API key.',
        queryParameters: [
          {
            name: 'limit',
            type: 'integer',
            required: false,
            default: '20',
            description: 'Maximum number of conversations to return (1-100)',
          },
          {
            name: 'offset',
            type: 'integer',
            required: false,
            default: '0',
            description: 'Number of conversations to skip for pagination',
          },
        ],
        responses: [
          {
            status: 200,
            description: 'List of conversations',
            example: {
              object: 'list',
              data: [
                {
                  id: '550e8400-e29b-41d4-a716-446655440000',
                  object: 'conversation',
                  title: 'EOS Implementation Questions',
                  model: 'eosai-v1',
                  message_count: 4,
                  total_tokens: 1250,
                  created_at: '2026-02-04T12:00:00.000Z',
                  updated_at: '2026-02-04T14:30:00.000Z',
                },
              ],
              has_more: false,
            },
          },
        ],
        codeExamples: {
          curl: `curl https://eosbot.ai/api/v1/conversations?limit=10 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          javascript: `const response = await fetch('https://eosbot.ai/api/v1/conversations?limit=10', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const { data: conversations } = await response.json();
conversations.forEach(conv => console.log(conv.title));`,
          python: `import requests

response = requests.get(
    'https://eosbot.ai/api/v1/conversations',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params={'limit': 10}
)

conversations = response.json()['data']
for conv in conversations:
    print(conv['title'])`,
        },
      },
      {
        method: 'GET',
        path: '/v1/conversations/{id}',
        summary: 'Get conversation',
        description: 'Retrieve a single conversation with all its messages.',
        pathParameters: [
          {
            name: 'id',
            type: 'string (uuid)',
            required: true,
            description: 'The conversation ID',
          },
        ],
        responses: [
          {
            status: 200,
            description: 'Conversation with messages',
            example: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              object: 'conversation',
              title: 'EOS Implementation Questions',
              model: 'eosai-v1',
              system_prompt: null,
              metadata: null,
              message_count: 2,
              total_tokens: 500,
              created_at: '2026-02-04T12:00:00.000Z',
              updated_at: '2026-02-04T12:05:00.000Z',
              messages: [
                {
                  id: 'msg-123',
                  role: 'user',
                  content: 'What is a Level 10 Meeting?',
                  token_count: 8,
                  created_at: '2026-02-04T12:00:00.000Z',
                },
                {
                  id: 'msg-124',
                  role: 'assistant',
                  content: 'A Level 10 Meeting is a weekly...',
                  token_count: 492,
                  created_at: '2026-02-04T12:00:05.000Z',
                },
              ],
            },
          },
        ],
        codeExamples: {
          curl: `curl https://eosbot.ai/api/v1/conversations/550e8400-e29b-41d4-a716-446655440000 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          javascript: `const conversationId = '550e8400-e29b-41d4-a716-446655440000';

const response = await fetch(\`https://eosbot.ai/api/v1/conversations/\${conversationId}\`, {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const conversation = await response.json();
console.log('Messages:', conversation.messages.length);`,
          python: `import requests

conversation_id = '550e8400-e29b-41d4-a716-446655440000'

response = requests.get(
    f'https://eosbot.ai/api/v1/conversations/{conversation_id}',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)

conversation = response.json()
print(f"Messages: {len(conversation['messages'])}")`,
        },
      },
      {
        method: 'POST',
        path: '/v1/conversations/{id}/messages',
        summary: 'Send message',
        description:
          "Send a message to a conversation and get an AI response. The conversation's message history is automatically included for context. Supports streaming.",
        pathParameters: [
          {
            name: 'id',
            type: 'string (uuid)',
            required: true,
            description: 'The conversation ID',
          },
        ],
        requestBody: {
          contentType: 'application/json',
          schema: {
            content: 'string (required, 1-32000 chars)',
            stream: 'boolean (default: false)',
            include_eos_context: 'boolean (default: true)',
            eos_namespace: 'string (default: eos-implementer)',
          },
          example: {
            content: 'How do I run an effective Level 10 Meeting?',
            stream: false,
          },
        },
        responses: [
          {
            status: 200,
            description: 'AI response message',
            example: {
              id: 'req-xyz789',
              object: 'conversation.message',
              conversation_id: '550e8400-e29b-41d4-a716-446655440000',
              role: 'assistant',
              content:
                'To run an effective Level 10 Meeting, follow these steps...',
              token_count: 350,
              finish_reason: 'stop',
              usage: {
                prompt_tokens: 150,
                completion_tokens: 350,
                total_tokens: 500,
              },
            },
          },
        ],
        codeExamples: {
          curl: `# Non-streaming
curl -X POST https://eosbot.ai/api/v1/conversations/CONVERSATION_ID/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "How do I run an effective Level 10 Meeting?"
  }'

# Streaming
curl -X POST https://eosbot.ai/api/v1/conversations/CONVERSATION_ID/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -N \\
  -d '{
    "content": "How do I run an effective Level 10 Meeting?",
    "stream": true
  }'`,
          javascript: `const conversationId = '550e8400-e29b-41d4-a716-446655440000';

// Non-streaming
const response = await fetch(\`https://eosbot.ai/api/v1/conversations/\${conversationId}/messages\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'How do I run an effective Level 10 Meeting?',
  }),
});
const message = await response.json();
console.log(message.content);

// Streaming
const streamResponse = await fetch(\`https://eosbot.ai/api/v1/conversations/\${conversationId}/messages\`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'How do I run an effective Level 10 Meeting?',
    stream: true,
  }),
});

const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));
  
  for (const line of lines) {
    const data = line.slice(6);
    if (data === '[DONE]') continue;
    const parsed = JSON.parse(data);
    const content = parsed.delta?.content;
    if (content) process.stdout.write(content);
  }
}`,
          python: `import requests
import json

conversation_id = '550e8400-e29b-41d4-a716-446655440000'

# Non-streaming
response = requests.post(
    f'https://eosbot.ai/api/v1/conversations/{conversation_id}/messages',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={'content': 'How do I run an effective Level 10 Meeting?'}
)
message = response.json()
print(message['content'])

# Streaming
response = requests.post(
    f'https://eosbot.ai/api/v1/conversations/{conversation_id}/messages',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'content': 'How do I run an effective Level 10 Meeting?',
        'stream': True
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = line[6:]
            if data == '[DONE]':
                break
            parsed = json.loads(data)
            content = parsed.get('delta', {}).get('content', '')
            if content:
                print(content, end='', flush=True)`,
        },
      },
      {
        method: 'DELETE',
        path: '/v1/conversations/{id}',
        summary: 'Delete conversation',
        description: 'Delete a conversation and all its messages permanently.',
        pathParameters: [
          {
            name: 'id',
            type: 'string (uuid)',
            required: true,
            description: 'The conversation ID',
          },
        ],
        responses: [
          {
            status: 200,
            description: 'Conversation deleted',
            example: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              object: 'conversation.deleted',
              deleted: true,
            },
          },
        ],
        codeExamples: {
          curl: `curl -X DELETE https://eosbot.ai/api/v1/conversations/CONVERSATION_ID \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          javascript: `const conversationId = '550e8400-e29b-41d4-a716-446655440000';

const response = await fetch(\`https://eosbot.ai/api/v1/conversations/\${conversationId}\`, {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const result = await response.json();
console.log('Deleted:', result.deleted);`,
          python: `import requests

conversation_id = '550e8400-e29b-41d4-a716-446655440000'

response = requests.delete(
    f'https://eosbot.ai/api/v1/conversations/{conversation_id}',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)

result = response.json()
print(f"Deleted: {result['deleted']}")`,
        },
      },
    ],
  },
  {
    id: 'documents',
    title: 'Document Analysis',
    description: 'Analyze documents and answer questions about their content.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/documents/analyze',
        summary: 'Analyze document',
        description:
          'Analyze a document and answer questions about it. Supports JSON with text content or multipart form data with file uploads (PDF, DOCX, XLSX, PPTX, TXT, MD, images).',
        badge: 'New',
        requestBody: {
          contentType: 'application/json or multipart/form-data',
          schema: {
            document: 'string (text content, max 100000 chars)',
            file: 'file (PDF, DOCX, XLSX, PPTX, TXT, MD, or images)',
            question: 'string (required, max 4000 chars)',
            model: 'string (default: eosai-v1)',
            stream: 'boolean (default: false)',
            include_eos_context: 'boolean (default: false)',
            max_chunks: 'integer 1-20 (default: 5)',
          },
          example: {
            document:
              'Our company core values are: 1. Customer First - We prioritize customer needs...',
            question: "What are the company's core values?",
            model: 'eosai-v1',
          },
        },
        responses: [
          {
            status: 200,
            description: 'Document analysis result',
            example: {
              id: 'doc-analysis-123',
              object: 'document.analysis',
              answer: "The company's core values are: 1. Customer First...",
              model: 'eosai-v1',
              chunks_analyzed: 3,
              total_chunks: 8,
              finish_reason: 'stop',
              usage: {
                prompt_tokens: 1200,
                completion_tokens: 250,
                total_tokens: 1450,
              },
            },
          },
        ],
        codeExamples: {
          curl: `# With text content
curl -X POST https://eosbot.ai/api/v1/documents/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "document": "Our core values are...",
    "question": "What are the core values?"
  }'

# With file upload
curl -X POST https://eosbot.ai/api/v1/documents/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@meeting-notes.pdf" \\
  -F "question=What were the action items?"`,
          javascript: `// With text content
const response = await fetch('https://eosbot.ai/api/v1/documents/analyze', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    document: 'Our core values are...',
    question: 'What are the core values?',
  }),
});

const analysis = await response.json();
console.log(analysis.answer);

// With file upload
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('question', 'What were the action items?');

const fileResponse = await fetch('https://eosbot.ai/api/v1/documents/analyze', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
  body: formData,
});`,
          python: `import requests

# With text content
response = requests.post(
    'https://eosbot.ai/api/v1/documents/analyze',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'document': 'Our core values are...',
        'question': 'What are the core values?'
    }
)

analysis = response.json()
print(analysis['answer'])

# With file upload
with open('meeting-notes.pdf', 'rb') as f:
    response = requests.post(
        'https://eosbot.ai/api/v1/documents/analyze',
        headers={'Authorization': 'Bearer YOUR_API_KEY'},
        files={'file': f},
        data={'question': 'What were the action items?'}
    )`,
        },
      },
    ],
  },
  {
    id: 'embeddings',
    title: 'Embeddings',
    description:
      'Generate vector embeddings for semantic search and similarity.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/embeddings',
        summary: 'Create embeddings',
        description:
          "Generate vector embeddings for text input(s). Uses OpenAI's text-embedding-ada-002 model (1536 dimensions). Useful for semantic search, clustering, and RAG applications.",
        requestBody: {
          contentType: 'application/json',
          schema: {
            input:
              'string or array of strings (required, max 32000 chars each)',
            model: 'string (default: text-embedding-ada-002)',
            encoding_format: 'string: float or base64 (default: float)',
          },
          example: {
            input: 'What is the Entrepreneurial Operating System?',
            model: 'text-embedding-ada-002',
          },
        },
        responses: [
          {
            status: 200,
            description: 'Embedding vectors',
            example: {
              object: 'list',
              data: [
                {
                  object: 'embedding',
                  index: 0,
                  embedding: [0.0023064255, -0.009327292, 0.015797086, '...'],
                },
              ],
              model: 'text-embedding-ada-002',
              usage: {
                prompt_tokens: 8,
                total_tokens: 8,
              },
            },
          },
        ],
        codeExamples: {
          curl: `curl -X POST https://eosbot.ai/api/v1/embeddings \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": "What is the Entrepreneurial Operating System?"
  }'`,
          javascript: `const response = await fetch('https://eosbot.ai/api/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    input: 'What is the Entrepreneurial Operating System?',
  }),
});

const { data } = await response.json();
const embedding = data[0].embedding;
console.log('Dimensions:', embedding.length); // 1536`,
          python: `import requests

response = requests.post(
    'https://eosbot.ai/api/v1/embeddings',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'input': 'What is the Entrepreneurial Operating System?'
    }
)

data = response.json()['data']
embedding = data[0]['embedding']
print(f"Dimensions: {len(embedding)}")  # 1536`,
        },
      },
    ],
  },
  {
    id: 'models',
    title: 'Models',
    description: 'Discover available models and EOS knowledge namespaces.',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/models',
        summary: 'List models',
        description:
          'Returns a list of available EOSAI models and EOS knowledge namespaces. Models may be restricted based on your API key configuration.',
        responses: [
          {
            status: 200,
            description: 'List of models and namespaces',
            example: {
              object: 'list',
              data: [
                {
                  id: 'eosai-v1',
                  object: 'model',
                  created: 1706140800,
                  owned_by: 'eosai',
                  description:
                    'Powered by Claude Sonnet 4.5 - Best balance of speed and quality',
                  context_window: 200000,
                  max_output_tokens: 4096,
                  capabilities: ['chat', 'eos_rag'],
                },
                {
                  id: 'eosai-v1-fast',
                  object: 'model',
                  created: 1706140800,
                  owned_by: 'eosai',
                  description:
                    'Powered by Claude Haiku 4.5 - Optimized for quick responses',
                  context_window: 200000,
                  max_output_tokens: 4096,
                  capabilities: ['chat', 'eos_rag'],
                },
                {
                  id: 'eosai-v1-pro',
                  object: 'model',
                  created: 1706140800,
                  owned_by: 'eosai',
                  description:
                    'Powered by Claude Opus 4.5 - Enhanced reasoning with extended thinking',
                  context_window: 200000,
                  max_output_tokens: 16384,
                  capabilities: ['chat', 'eos_rag', 'extended_thinking'],
                },
              ],
              eos_namespaces: [
                {
                  id: 'eos-implementer',
                  name: 'EOS Implementer',
                  description: 'General EOS implementation knowledge',
                },
                {
                  id: 'eos-implementer-quarterly-session',
                  name: 'Quarterly Session',
                  description: 'Quarterly planning and review facilitation',
                },
              ],
            },
          },
        ],
        codeExamples: {
          curl: `curl https://eosbot.ai/api/v1/models \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          javascript: `const response = await fetch('https://eosbot.ai/api/v1/models', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const { data: models, eos_namespaces } = await response.json();

models.forEach(model => {
  console.log(\`\${model.id}: \${model.description}\`);
});`,
          python: `import requests

response = requests.get(
    'https://eosbot.ai/api/v1/models',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)

data = response.json()
for model in data['data']:
    print(f"{model['id']}: {model['description']}")`,
        },
      },
    ],
  },
  {
    id: 'usage',
    title: 'Usage',
    description: 'Monitor API usage and rate limits for your API key.',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/usage',
        summary: 'Get usage statistics',
        description:
          'Returns usage statistics and rate limit information for your API key. Useful for monitoring consumption and remaining quota.',
        queryParameters: [
          {
            name: 'days',
            type: 'integer',
            required: false,
            default: '30',
            description: 'Number of days of history to include (1-90)',
          },
        ],
        responses: [
          {
            status: 200,
            description: 'Usage statistics',
            example: {
              object: 'usage',
              api_key: {
                id: 'uuid',
                name: 'My Production Key',
                prefix: 'eos_abcd...',
                created_at: '2026-01-15T10:00:00.000Z',
                expires_at: null,
                is_active: true,
                scopes: ['chat'],
              },
              rate_limits: {
                requests_per_minute: 60,
                requests_per_day: 1000,
                remaining_rpm: 55,
                remaining_rpd: 850,
                reset_rpm: '2026-02-04T12:01:00.000Z',
                reset_rpd: '2026-02-05T00:00:00.000Z',
              },
              usage: {
                period_days: 30,
                total_requests: 1250,
                total_tokens: 875000,
                average_response_time_ms: 1200,
                error_rate: 0.02,
                lifetime_requests: 5000,
                lifetime_tokens: 3500000,
              },
              usage_by_day: [
                { date: '2026-02-01', requests: 45, tokens: 31500 },
                { date: '2026-02-02', requests: 52, tokens: 36400 },
              ],
              usage_by_endpoint: [
                { endpoint: '/v1/chat', requests: 1200 },
                { endpoint: '/v1/conversations/messages', requests: 150 },
              ],
            },
          },
        ],
        codeExamples: {
          curl: `curl https://eosbot.ai/api/v1/usage?days=7 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
          javascript: `const response = await fetch('https://eosbot.ai/api/v1/usage?days=7', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  },
});

const usage = await response.json();
console.log('Requests today:', usage.usage.total_requests);
console.log('Remaining RPM:', usage.rate_limits.remaining_rpm);`,
          python: `import requests

response = requests.get(
    'https://eosbot.ai/api/v1/usage',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params={'days': 7}
)

usage = response.json()
print(f"Requests today: {usage['usage']['total_requests']}")
print(f"Remaining RPM: {usage['rate_limits']['remaining_rpm']}")`,
        },
      },
    ],
  },
];

// Request body parameters for detailed documentation
export const chatRequestParameters: ApiParameter[] = [
  {
    name: 'messages',
    type: 'array',
    required: true,
    description:
      'Array of message objects with role (system/user/assistant) and content',
  },
  {
    name: 'model',
    type: 'string',
    required: false,
    default: 'eosai-v1',
    description: 'Model to use for completion',
    enum: ['eosai-v1', 'eosai-v1-fast', 'eosai-v1-pro'],
  },
  {
    name: 'stream',
    type: 'boolean',
    required: false,
    default: 'false',
    description: 'If true, returns a stream of server-sent events',
  },
  {
    name: 'temperature',
    type: 'number',
    required: false,
    default: '0.7',
    description:
      'Sampling temperature (0-2). Higher values make output more random',
  },
  {
    name: 'max_tokens',
    type: 'integer',
    required: false,
    default: '4096',
    description: 'Maximum number of tokens to generate (1-16384)',
  },
  {
    name: 'top_p',
    type: 'number',
    required: false,
    description: 'Nucleus sampling parameter (0-1)',
  },
  {
    name: 'frequency_penalty',
    type: 'number',
    required: false,
    description: 'Penalty for token frequency (-2 to 2)',
  },
  {
    name: 'presence_penalty',
    type: 'number',
    required: false,
    description: 'Penalty for token presence (-2 to 2)',
  },
  {
    name: 'stop',
    type: 'string | string[]',
    required: false,
    description: 'Sequences where the API will stop generating',
  },
  {
    name: 'include_eos_context',
    type: 'boolean',
    required: false,
    default: 'true',
    description: 'Whether to include EOS knowledge base context',
  },
  {
    name: 'eos_namespace',
    type: 'string',
    required: false,
    default: 'eos-implementer',
    description: 'EOS knowledge namespace to search for context',
  },
];

// Error codes reference
export const errorCodes = [
  {
    status: 400,
    type: 'invalid_request_error',
    code: 'invalid_json',
    description: 'Request body is not valid JSON',
    solution:
      'Ensure your request body is valid JSON. Check for missing quotes, commas, or brackets.',
  },
  {
    status: 400,
    type: 'invalid_request_error',
    code: 'invalid_param',
    description: 'A request parameter is invalid',
    solution:
      'Check the parameter value against the API documentation. Common issues: wrong type, out of range, or missing required field.',
  },
  {
    status: 400,
    type: 'invalid_request_error',
    code: 'model_not_found',
    description: 'The requested model does not exist',
    solution: 'Use one of: eosai-v1, eosai-v1-fast, or eosai-v1-pro',
  },
  {
    status: 400,
    type: 'invalid_request_error',
    code: 'message_too_long',
    description: 'Message content exceeds maximum length',
    solution: 'Reduce message content to under 32,000 characters.',
  },
  {
    status: 401,
    type: 'authentication_error',
    code: 'missing_api_key',
    description: 'No API key provided in request',
    solution:
      'Include your API key in the Authorization header: "Bearer YOUR_API_KEY"',
  },
  {
    status: 401,
    type: 'authentication_error',
    code: 'invalid_api_key',
    description: 'API key is invalid or expired',
    solution:
      'Check your API key is correct and has not expired. Generate a new key if needed.',
  },
  {
    status: 401,
    type: 'authentication_error',
    code: 'invalid_api_key_format',
    description: 'API key format is invalid',
    solution:
      'API keys should start with "eos_" prefix. Ensure you copied the full key.',
  },
  {
    status: 403,
    type: 'permission_error',
    code: 'insufficient_scope',
    description: 'API key lacks required permissions',
    solution:
      'Create a new API key with the required scope (e.g., "chat" for chat endpoints).',
  },
  {
    status: 403,
    type: 'permission_error',
    code: 'model_not_allowed',
    description: 'API key cannot access this model',
    solution:
      'Your API key may be restricted to certain models. Contact support to upgrade.',
  },
  {
    status: 404,
    type: 'invalid_request_error',
    code: 'not_found',
    description: 'Resource not found',
    solution:
      'Check the resource ID is correct. The conversation or document may have been deleted.',
  },
  {
    status: 429,
    type: 'rate_limit_error',
    code: 'rate_limit_exceeded',
    description: 'Too many requests',
    solution:
      'Wait and retry with exponential backoff. Check X-RateLimit-Reset-RPM header for reset time.',
  },
  {
    status: 500,
    type: 'server_error',
    code: 'internal_error',
    description: 'Internal server error',
    solution:
      'Retry the request. If the error persists, contact support with the request ID.',
  },
  {
    status: 503,
    type: 'server_error',
    code: 'service_unavailable',
    description: 'Service temporarily unavailable',
    solution:
      'The service is under heavy load or maintenance. Retry with exponential backoff.',
  },
];

// Error handling code examples
export const errorHandlingExamples = {
  javascript: `// Robust error handling with retry logic
async function callEOSAI(messages, options = {}) {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://eosbot.ai/api/v1/chat', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${process.env.EOSAI_API_KEY}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, model: 'eosai-v1' }),
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : baseDelay * Math.pow(2, attempt);
        console.log(\`Rate limited. Retrying in \${delay}ms...\`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Handle server errors with retry
      if (response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(\`Server error. Retrying in \${delay}ms...\`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Parse response
      const data = await response.json();

      // Handle API errors
      if (!response.ok) {
        const error = data.error;
        throw new Error(\`[\${error.code}] \${error.message}\`);
      }

      return data;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
}

// Usage
try {
  const result = await callEOSAI([
    { role: 'user', content: 'What is a Level 10 Meeting?' }
  ]);
  console.log(result.choices[0].message.content);
} catch (error) {
  console.error('API Error:', error.message);
}`,
  python: `import requests
import time
from typing import Optional

class EOSAIError(Exception):
    def __init__(self, message: str, code: str, status: int):
        self.message = message
        self.code = code
        self.status = status
        super().__init__(f"[{code}] {message}")

def call_eosai(messages: list, max_retries: int = 3, base_delay: float = 1.0) -> dict:
    """Call EOSAI API with automatic retry and error handling."""
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                'https://eosbot.ai/api/v1/chat',
                headers={
                    'Authorization': f'Bearer {os.environ["EOSAI_API_KEY"]}',
                    'Content-Type': 'application/json',
                },
                json={'messages': messages, 'model': 'eosai-v1'},
                timeout=60
            )
            
            # Handle rate limiting
            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After')
                delay = int(retry_after) if retry_after else base_delay * (2 ** attempt)
                print(f"Rate limited. Retrying in {delay}s...")
                time.sleep(delay)
                continue
            
            # Handle server errors with retry
            if response.status_code >= 500:
                delay = base_delay * (2 ** attempt)
                print(f"Server error. Retrying in {delay}s...")
                time.sleep(delay)
                continue
            
            data = response.json()
            
            # Handle API errors
            if not response.ok:
                error = data.get('error', {})
                raise EOSAIError(
                    error.get('message', 'Unknown error'),
                    error.get('code', 'unknown'),
                    response.status_code
                )
            
            return data
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"Request failed: {e}. Retrying in {delay}s...")
            time.sleep(delay)
    
    raise Exception("Max retries exceeded")

# Usage
try:
    result = call_eosai([
        {'role': 'user', 'content': 'What is a Level 10 Meeting?'}
    ])
    print(result['choices'][0]['message']['content'])
except EOSAIError as e:
    print(f"API Error ({e.status}): {e.message}")
except Exception as e:
    print(f"Error: {e}")`,
};

// Get all endpoints as flat list
export function getAllEndpoints(): ApiEndpoint[] {
  return apiCategories.flatMap((category) => category.endpoints);
}

// Get endpoint by method and path
export function getEndpoint(
  method: string,
  path: string,
): ApiEndpoint | undefined {
  return getAllEndpoints().find((e) => e.method === method && e.path === path);
}
