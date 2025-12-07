import { useState, useRef, useEffect } from 'react'
import { Message, sendMessage } from '../services/conversationService'

interface ChatInterfaceProps {
  sessionId: string | null
  messages: Message[]
  onMessagesChange: (messages: Message[]) => void
  onSessionStart: (date: Date) => void
}

function ChatInterface({
  sessionId,
  messages,
  onMessagesChange,
  onSessionStart,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [sessionStart, setSessionStart] = useState<Date | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getRelativeTime = (date: Date): string => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handleClearClick = () => {
    setShowClearConfirm(true)
  }

  const confirmClearChat = () => {
    onMessagesChange([])
    setSessionStart(null)
    setShowClearConfirm(false)
  }

  const cancelClearChat = () => {
    setShowClearConfirm(false)
  }

  useEffect(() => {
    if (messages.length > 0 && !sessionStart) {
      const firstMessageTime = messages[0].timestamp
      setSessionStart(firstMessageTime)
      onSessionStart(firstMessageTime)
    }
  }, [messages, sessionStart, onSessionStart])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !sessionId) {
      console.log('Cannot send - input:', input.trim(), 'isLoading:', isLoading, 'sessionId:', sessionId)
      return
    }

    console.log('=== Sending Message ===')
    console.log('SessionId:', sessionId)
    console.log('Message:', input.trim())

    // Set session start time when first message is sent
    if (messages.length === 0) {
      const startTime = new Date()
      setSessionStart(startTime)
      onSessionStart(startTime)
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    const newMessages = [...messages, userMessage]
    onMessagesChange(newMessages)
    setInput('')
    setIsLoading(true)
    const startTime = Date.now()

    try {
      console.log('Calling sendMessage API with sessionId:', sessionId)
      const data = await sendMessage(userMessage.content, sessionId)
      console.log('Send message response:', data)
      setIsConnected(true)
      const botReply = data.response || data.message || 'No response received'
      const responseTime = ((Date.now() - startTime) / 1000).toFixed(1)

      const assistantMessage: Message = {
        role: 'assistant',
        content: botReply,
        timestamp: new Date(),
        responseTime: parseFloat(responseTime),
      }

      onMessagesChange([...newMessages, assistantMessage])
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch (error) {
      console.error('Error sending message:', error)
      setIsConnected(false)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      }
      onMessagesChange([...newMessages, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-r-2xl shadow-2xl border-r border-t border-b border-slate-700/50 overflow-hidden flex flex-col h-full">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-700/50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-xs text-slate-400 font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {messages.length > 0 && sessionStart && (
            <span className="text-xs text-slate-500">
              {messages.length} message{messages.length !== 1 ? 's' : ''} • Started {sessionStart.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {showSuccess && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span>✓</span> Sent
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearClick}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-700/50 flex items-center gap-1"
              title="Clear conversation"
            >
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-900/50 to-transparent">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-semibold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">Start a conversation!</p>
            <p className="text-sm text-slate-400 mb-4">Type your message below and press Enter to send.</p>
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-400 mb-2">Try asking:</p>
              <p className="text-slate-500">"What's the price of AAPL?"</p>
              <p className="text-slate-500">"Tell me about TSLA"</p>
            </div>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex animate-fade-in ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 group relative ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/20'
                  : message.content.startsWith('Error:')
                  ? 'bg-slate-700/80 text-slate-100 border-2 border-red-500/50'
                  : 'bg-slate-700/80 text-slate-100 border border-slate-600/50'
              }`}
            >
              {message.content.startsWith('Error:') && (
                <div className="flex items-center gap-2 mb-2 text-red-400">
                  <span>⚠️</span>
                  <span className="text-xs font-medium">Error</span>
                </div>
              )}
              <p className="whitespace-pre-wrap break-words leading-relaxed font-normal">{message.content}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-xs ${
                      message.role === 'user' ? 'text-cyan-100/70' : 'text-slate-400'
                    }`}
                    title={message.timestamp.toLocaleString()}
                  >
                    {getRelativeTime(message.timestamp)}
                  </p>
                  {message.responseTime && (
                    <span className="text-xs text-slate-500">• {message.responseTime}s</span>
                  )}
                </div>
                <button
                  onClick={() => copyToClipboard(message.content)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-400 hover:text-slate-200 ml-2 px-2 py-1 rounded hover:bg-slate-600/50"
                  title="Copy message"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/80 rounded-2xl px-4 py-3 border border-slate-600/50">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="border-t border-slate-700/50 p-4 bg-slate-800/30 backdrop-blur-sm">
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 resize-none bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-normal"
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim() || !sessionId}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl hover:from-cyan-400 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-105 active:scale-95 disabled:shadow-none disabled:hover:scale-100"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Press <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-300">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-300">Shift+Enter</kbd> for new line</span>
            <button className="text-slate-500 hover:text-slate-300 transition-colors" title="Keyboard shortcuts">⌨️</button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 shadow-xl animate-fade-in flex items-center gap-2 z-50">
          <span>✓</span>
          <span className="text-sm text-slate-200">Copied to clipboard</span>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">Clear Chat History?</h3>
              <p className="text-sm text-slate-400">
                Are you sure you want to clear all messages? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelClearChat}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-all font-medium"
              >
                No, Keep Chat
              </button>
              <button
                onClick={confirmClearChat}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-red-500/20"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInterface

