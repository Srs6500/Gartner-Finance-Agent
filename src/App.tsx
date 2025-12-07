import { useState, useEffect, useRef } from 'react'
import ChatInterface from './components/ChatInterface'
import ConversationSidebar, { Conversation } from './components/ConversationSidebar'
import {
  generateSessionId,
  getConversations,
  loadConversation,
  deleteConversation,
  renameConversation,
  Message,
} from './services/conversationService'

function App() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [, setSessionStart] = useState<Date | null>(null)
  const [, setIsLoadingConversations] = useState(true)
  
  // Cache messages per sessionId to prevent loss when toggling
  const messagesCache = useRef<Map<string, Message[]>>(new Map())
  const sessionStartCache = useRef<Map<string, Date>>(new Map())

  // Load conversations on mount
  useEffect(() => {
    loadConversationsList()
  }, [])

  const loadConversationsList = async () => {
    try {
      setIsLoadingConversations(true)
      const convs = await getConversations()
      setConversations(convs)
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const handleNewChat = () => {
    const newSessionId = generateSessionId()
    setCurrentSessionId(newSessionId)
    setMessages([])
    setSessionStart(null)
    // Clear cache for new session (it's empty anyway)
    messagesCache.current.set(newSessionId, [])
    sessionStartCache.current.delete(newSessionId)
    // Save sessionId to localStorage
    localStorage.setItem('currentSessionId', newSessionId)
  }

  const handleSelectConversation = async (sessionId: string) => {
    const requestedSessionId = sessionId
    
    try {
      console.log('=== Loading Conversation ===')
      console.log('Requested SessionId:', requestedSessionId)
      
      // Set sessionId first to update UI immediately
      setCurrentSessionId(requestedSessionId)
      localStorage.setItem('currentSessionId', requestedSessionId)
      
      // STEP 1: Restore from cache FIRST (instant display, no flicker)
      const cachedMessages = messagesCache.current.get(requestedSessionId)
      const cachedSessionStart = sessionStartCache.current.get(requestedSessionId)
      
      if (cachedMessages && cachedMessages.length > 0) {
        console.log('✅ Restoring from cache:', cachedMessages.length, 'messages')
        setMessages(cachedMessages)
        if (cachedSessionStart) {
          setSessionStart(cachedSessionStart)
        }
      } else {
        console.log('No cache found, will load from API')
        // Don't clear messages here - keep previous conversation visible while loading
      }
      
      // STEP 2: Load from API to get latest (in background)
      console.log('Calling loadConversation API...')
      const loadedMessages = await loadConversation(requestedSessionId)
      console.log('API Response - Loaded messages:', loadedMessages)
      console.log('Messages type:', typeof loadedMessages)
      console.log('Is array?', Array.isArray(loadedMessages))
      console.log('Messages length:', loadedMessages?.length)
      
      // Check if user clicked another conversation while loading
      const currentSession = localStorage.getItem('currentSessionId')
      if (currentSession !== requestedSessionId) {
        console.log('⚠️ User clicked another conversation, ignoring this load')
        return
      }
      
      // STEP 3: Update with API data and cache it
      if (loadedMessages && Array.isArray(loadedMessages)) {
        // Save to cache
        messagesCache.current.set(requestedSessionId, loadedMessages)
        
        if (loadedMessages.length > 0) {
          console.log('✅ Setting messages from API:', loadedMessages.length, 'messages')
          setMessages(loadedMessages)
          
          // Handle both Date objects and ISO strings
          const firstTimestamp = loadedMessages[0].timestamp instanceof Date 
            ? loadedMessages[0].timestamp 
            : new Date(loadedMessages[0].timestamp)
          setSessionStart(firstTimestamp)
          sessionStartCache.current.set(requestedSessionId, firstTimestamp)
          console.log('✅ Messages set and cached successfully!')
        } else {
          console.warn('⚠️ Empty messages array returned from API')
          setMessages([])
          setSessionStart(null)
          messagesCache.current.set(requestedSessionId, [])
        }
      } else {
        console.error('❌ Invalid messages format:', loadedMessages)
        // Keep cached messages if API fails
        if (!cachedMessages || cachedMessages.length === 0) {
          setMessages([])
          setSessionStart(null)
        }
      }
    } catch (error) {
      console.error('=== ERROR Loading Conversation ===')
      console.error('Error:', error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      
      // Check if we're still on the requested session
      const currentSession = localStorage.getItem('currentSessionId')
      if (currentSession === requestedSessionId) {
        // If we have cached messages, keep them. Otherwise show empty
        const cachedMessages = messagesCache.current.get(requestedSessionId)
        if (cachedMessages && cachedMessages.length > 0) {
          console.log('Error occurred, but keeping cached messages')
          setMessages(cachedMessages)
        } else {
          console.log('No cache available, setting empty messages due to error')
          setMessages([])
          setSessionStart(null)
        }
      } else {
        console.log('Session changed, not updating messages')
      }
    }
  }

  const handleDeleteConversation = async (sessionId: string) => {
    try {
      await deleteConversation(sessionId)
      // Remove from local state immediately
      setConversations(convs => convs.filter(c => c.sessionId !== sessionId))
      
      // Clear from cache
      messagesCache.current.delete(sessionId)
      sessionStartCache.current.delete(sessionId)
      
      // If deleted conversation was current, start new chat
      if (sessionId === currentSessionId) {
        handleNewChat()
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
      // Reload conversations on error to sync state
      await loadConversationsList()
    }
  }

  const handleRenameConversation = async (sessionId: string, newTitle: string) => {
    try {
      await renameConversation(sessionId, newTitle)
      // Update local state
      setConversations(convs =>
        convs.map(c =>
          c.sessionId === sessionId ? { ...c, title: newTitle } : c
        )
      )
      // Reload to ensure sync
      await loadConversationsList()
    } catch (error) {
      console.error('Error renaming conversation:', error)
    }
  }

  // Initialize session on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('currentSessionId')
    if (savedSessionId) {
      handleSelectConversation(savedSessionId)
    } else {
      handleNewChat()
    }
  }, [])

  // Update conversation title when messages change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      const title = messages[0]?.content?.substring(0, 50) || 'New Chat'
      
      // Update conversation in list if it exists
      setConversations(convs => {
        const existing = convs.find(c => c.sessionId === currentSessionId)
        if (existing) {
          return convs.map(c =>
            c.sessionId === currentSessionId
              ? {
                  ...c,
                  lastMessage: lastMessage.content.substring(0, 100),
                  timestamp: lastMessage.timestamp,
                  messageCount: messages.length,
                }
              : c
          )
        } else {
          // Add new conversation
          return [
            {
              sessionId: currentSessionId,
              title,
              lastMessage: lastMessage.content.substring(0, 100),
              timestamp: lastMessage.timestamp,
              messageCount: messages.length,
            },
            ...convs,
          ]
        }
      })
    }
  }, [messages, currentSessionId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="w-screen flex flex-col items-center justify-center py-6 relative">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="text-5xl">🧠</div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight text-center">
            Bedrock Chat Assistant
          </h1>
        </div>
        <p className="text-center bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 text-lg font-bold">
          AI Is Cool I guess
        </p>
        <p className="text-center text-slate-400 text-sm font-light">Powered by AWS Bedrock</p>
      </div>

      {/* Main Container - Sidebar + Chat Integrated */}
      <div className="flex h-[calc(100vh-200px)] max-w-7xl mx-auto px-4">
        {/* Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          currentSessionId={currentSessionId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
        />

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatInterface
            sessionId={currentSessionId}
            messages={messages}
            onMessagesChange={(newMessages) => {
              setMessages(newMessages)
              // Update cache whenever messages change
              if (currentSessionId) {
                messagesCache.current.set(currentSessionId, newMessages)
                // Update session start cache if we have messages
                if (newMessages.length > 0) {
                  const firstTimestamp = newMessages[0].timestamp instanceof Date 
                    ? newMessages[0].timestamp 
                    : new Date(newMessages[0].timestamp)
                  sessionStartCache.current.set(currentSessionId, firstTimestamp)
                }
              }
            }}
            onSessionStart={setSessionStart}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="w-screen flex items-center justify-center py-4 relative">
        <p className="text-center text-xs text-slate-500">
          Built with React + TypeScript + AWS Bedrock
        </p>
      </div>
    </div>
  )
}

export default App



