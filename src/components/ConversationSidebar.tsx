import { useState } from 'react'

export interface Conversation {
  sessionId: string
  title: string
  lastMessage: string
  timestamp: Date
  messageCount: number
}

interface ConversationSidebarProps {
  conversations: Conversation[]
  currentSessionId: string | null
  onNewChat: () => void
  onSelectConversation: (sessionId: string) => void
  onDeleteConversation: (sessionId: string) => void
  onRenameConversation: (sessionId: string, newTitle: string) => void
}

function ConversationSidebar({
  conversations,
  currentSessionId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const getRelativeTime = (date: Date): string => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const handleRename = (conversation: Conversation) => {
    setEditingId(conversation.sessionId)
    setEditTitle(conversation.title)
  }

  const saveRename = async (sessionId: string) => {
    if (editTitle.trim()) {
      try {
        await onRenameConversation(sessionId, editTitle.trim())
        setEditingId(null)
        setEditTitle('')
      } catch (error) {
        console.error('Error renaming:', error)
        // Keep editing state on error so user can retry
      }
    } else {
      setEditingId(null)
      setEditTitle('')
    }
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditTitle('')
  }

  return (
    <div className="w-64 bg-slate-800/50 backdrop-blur-xl rounded-l-2xl border-l border-t border-b border-slate-700/50 flex flex-col h-full shadow-2xl">
      {/* New Chat Button */}
      <div className="p-4 border-b border-slate-700/50">
        <button
          onClick={onNewChat}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-xl transition-all font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
        >
          <span>💬</span>
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs text-slate-500 px-2 py-2 font-medium">Conversations</div>
        {conversations.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8 px-4">
            <p>No conversations yet</p>
            <p className="text-xs mt-2 text-slate-600">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.sessionId}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  currentSessionId === conversation.sessionId
                    ? 'bg-gradient-to-r from-cyan-500/15 to-purple-600/15 border border-cyan-500/25 shadow-sm'
                    : 'hover:bg-slate-700/40 border border-transparent'
                }`}
                onClick={() => onSelectConversation(conversation.sessionId)}
              >
                {editingId === conversation.sessionId ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') await saveRename(conversation.sessionId)
                        if (e.key === 'Escape') cancelRename()
                      }}
                      className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await saveRename(conversation.sessionId)
                        }}
                        className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                      >
                        ✓
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          cancelRename()
                        }}
                        className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {conversation.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {conversation.lastMessage}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {getRelativeTime(conversation.timestamp)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRename(conversation)
                          }}
                          className="p-1 hover:bg-slate-600/50 rounded transition-colors"
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteConfirm(conversation.sessionId)
                          }}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">Delete Conversation?</h3>
              <p className="text-sm text-slate-400">
                Are you sure you want to delete this conversation? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteConversation(showDeleteConfirm)
                  setShowDeleteConfirm(null)
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversationSidebar

