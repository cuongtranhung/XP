import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  Send,
  X,
  User,
  Clock,
  Save
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import ImageNotesApi from '../../../services/imageNotesApi';
import type { ImageNote } from '../../../types/imageNotes';
import Avatar from '../../common/Avatar';

interface ImageNotesPanelProps {
  attachmentId: string;
  attachmentName: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const ImageNotesPanel: React.FC<ImageNotesPanelProps> = ({
  attachmentId,
  attachmentName,
  isVisible,
  onToggle
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ImageNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Fetch notes when panel becomes visible or attachment changes
  useEffect(() => {
    if (isVisible && attachmentId) {
      fetchNotes();
    }
  }, [isVisible, attachmentId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const fetchedNotes = await ImageNotesApi.getNotes(attachmentId);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error('Please enter a note');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to add notes');
      return;
    }

    try {
      setSubmitting(true);
      const newNote = await ImageNotesApi.createNote(attachmentId, newNoteContent);
      setNotes(prev => [...prev, newNote]);
      setNewNoteContent('');
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) {
      toast.error('Note content cannot be empty');
      return;
    }

    try {
      setSubmitting(true);
      const updatedNote = await ImageNotesApi.updateNote(attachmentId, noteId, editContent);
      setNotes(prev => prev.map(note => 
        note.id === noteId ? updatedNote : note
      ));
      setEditingNoteId(null);
      setEditContent('');
      toast.success('Note updated successfully');
    } catch (error) {
      console.error('Failed to update note:', error);
      toast.error('Failed to update note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await ImageNotesApi.deleteNote(attachmentId, noteId);
      setNotes(prev => prev.filter(note => note.id !== noteId));
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  const startEditing = (note: ImageNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const canEditNote = (note: ImageNote) => {
    return user && user.id === note.user_id;
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'recently';
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="shadow-2xl rounded-xl flex flex-col"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '400px',
        height: '100vh',
        zIndex: 2000,
        pointerEvents: 'auto',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.3)',
        borderLeft: '1px solid rgba(0, 0, 0, 0.1)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <div className="flex items-center space-x-2">
          <MessageSquare size={20} className="text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Image Notes 📝✨ (v2)</h3>
            <p className="text-xs text-gray-500 truncate" title={attachmentName}>
              {attachmentName}
            </p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No notes yet</p>
            <p className="text-xs">Be the first to add a note!</p>
          </div>
        ) : (
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-gray-50 rounded-lg p-3 border border-gray-100"
              >
                {/* Note Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Avatar
                      src={note.user?.avatar_url}
                      name={note.user?.full_name || 'Unknown'}
                      size="xs"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        {note.user?.full_name || 'Anonymous'}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Clock size={12} className="mr-1" />
                        {formatDate(note.created_at)}
                        {note.created_at !== note.updated_at && (
                          <span className="ml-1 text-gray-400">(edited)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {canEditNote(note) && editingNoteId !== note.id && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => startEditing(note)}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        title="Edit note"
                      >
                        <Edit2 size={12} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 size={12} className="text-red-500" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Note Content */}
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      maxLength={1000}
                      placeholder="Edit your note..."
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">
                        {editContent.length}/1000 characters
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEditing}
                          disabled={submitting}
                          className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          disabled={submitting || !editContent.trim()}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-1"
                        >
                          {submitting ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                          ) : (
                            <Save size={12} />
                          )}
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add Note Form */}
      {user && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="space-y-3">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Add a note about this image..."
              className="w-full p-3 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              maxLength={1000}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {newNoteContent.length}/1000 characters
              </span>
              <button
                onClick={handleCreateNote}
                disabled={submitting || !newNoteContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send size={16} />
                )}
                <span>Add Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 text-center">
          <p className="text-sm text-gray-500">
            Please log in to add notes
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default ImageNotesPanel;