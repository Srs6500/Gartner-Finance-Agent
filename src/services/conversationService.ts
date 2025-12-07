const API_ENDPOINT = import.meta.env.VITE_API_URL || 'https://zuev4x49wh.execute-api.us-east-1.amazonaws.com/Production/chat'

export interface Conversation {
  sessionId: string
  title: string
  lastMessage: string
  timestamp: Date
  messageCount: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  responseTime?: number
}

export interface ChatResponse {
  response?: string
  message?: string
  error?: string
  sessionId?: string
}

// Generate UUID for sessionId
export const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Send message to API
export const sendMessage = async (
  message: string,
  sessionId: string
): Promise<ChatResponse> => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY || '',
    },
    body: JSON.stringify({
      message,
      sessionId,
      action: 'send',
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return await response.json()
}

// Load conversation history
export const loadConversation = async (sessionId: string): Promise<Message[]> => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY || '',
    },
    body: JSON.stringify({
      sessionId,
      action: 'load',
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  console.log('=== Load Conversation API Response ===')
  console.log('Full response data:', JSON.stringify(data, null, 2))
  console.log('data.messages exists?', 'messages' in data)
  console.log('data.messages type:', typeof data.messages)
  console.log('data.messages is array?', Array.isArray(data.messages))
  console.log('data.messages length:', data.messages?.length)
  
  if (!data.messages) {
    console.warn('⚠️ No messages field in response!')
    console.warn('Response keys:', Object.keys(data))
  }
  
  // Convert ISO timestamp strings to Date objects
  const messages = (data.messages || []).map((msg: any, index: number) => {
    console.log(`Message ${index}:`, msg)
    return {
      role: msg.role || 'user',
      content: msg.content || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      responseTime: msg.responseTime,
    }
  })
  
  console.log('=== Formatted Messages ===')
  console.log('Total formatted messages:', messages.length)
  console.log('Formatted messages:', messages)
  return messages
}

// Get all conversations
export const getConversations = async (): Promise<Conversation[]> => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY || '',
    },
    body: JSON.stringify({
      action: 'list',
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  return (data.conversations || []).map((conv: any) => ({
    ...conv,
    timestamp: new Date(conv.timestamp),
  }))
}

// Delete conversation
export const deleteConversation = async (sessionId: string): Promise<void> => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY || '',
    },
    body: JSON.stringify({
      sessionId,
      action: 'delete',
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
}

// Rename conversation
export const renameConversation = async (
  sessionId: string,
  newTitle: string
): Promise<void> => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_API_KEY || '',
    },
    body: JSON.stringify({
      sessionId,
      title: newTitle,
      action: 'rename',
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
}

