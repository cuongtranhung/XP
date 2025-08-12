/**
 * Voice Commands Component - Phase 4 Implementation
 * Voice control support for accessibility
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAnnouncer } from '../../../hooks/useScreenReader';

interface VoiceCommand {
  command: string;
  action: () => void;
  description: string;
}

interface VoiceCommandsProps {
  onCommand?: (command: string) => void;
  customCommands?: VoiceCommand[];
  className?: string;
}

export const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  onCommand,
  customCommands = [],
  className
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const announcer = useAnnouncer();

  // Default voice commands
  const defaultCommands: VoiceCommand[] = [
    {
      command: 'add field',
      action: () => onCommand?.('add-field'),
      description: 'Add a new field'
    },
    {
      command: 'delete field',
      action: () => onCommand?.('delete-field'),
      description: 'Delete selected field'
    },
    {
      command: 'duplicate field',
      action: () => onCommand?.('duplicate-field'),
      description: 'Duplicate selected field'
    },
    {
      command: 'save form',
      action: () => onCommand?.('save-form'),
      description: 'Save the form'
    },
    {
      command: 'undo',
      action: () => onCommand?.('undo'),
      description: 'Undo last action'
    },
    {
      command: 'redo',
      action: () => onCommand?.('redo'),
      description: 'Redo last action'
    },
    {
      command: 'next field',
      action: () => onCommand?.('next-field'),
      description: 'Navigate to next field'
    },
    {
      command: 'previous field',
      action: () => onCommand?.('previous-field'),
      description: 'Navigate to previous field'
    },
    {
      command: 'show properties',
      action: () => onCommand?.('show-properties'),
      description: 'Show field properties'
    },
    {
      command: 'hide properties',
      action: () => onCommand?.('hide-properties'),
      description: 'Hide field properties'
    },
    {
      command: 'help',
      action: () => setShowHelp(true),
      description: 'Show voice commands help'
    },
    {
      command: 'stop listening',
      action: () => stopListening(),
      description: 'Stop voice commands'
    }
  ];

  const allCommands = [...defaultCommands, ...customCommands];

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSupported(true);
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
          announcer.announce('Voice commands activated. Say "help" for available commands.');
        };
        
        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript.toLowerCase().trim();
          
          setTranscript(transcript);
          
          // Check if result is final
          if (event.results[current].isFinal) {
            processCommand(transcript);
          }
        };
        
        recognition.onerror = (event: any) => {
          setError(`Speech recognition error: ${event.error}`);
          announcer.announceError(`Voice command error: ${event.error}`);
          
          if (event.error === 'no-speech') {
            setTranscript('');
          }
        };
        
        recognition.onend = () => {
          setIsListening(false);
          setTranscript('');
        };
        
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Process voice command
  const processCommand = useCallback((text: string) => {
    const cleanText = text.toLowerCase().trim();
    
    // Find matching command
    const matchedCommand = allCommands.find(cmd => 
      cleanText.includes(cmd.command.toLowerCase())
    );
    
    if (matchedCommand) {
      matchedCommand.action();
      announcer.announceSuccess(`Command executed: ${matchedCommand.command}`);
      setTranscript('');
    } else {
      // Try fuzzy matching
      const possibleCommands = allCommands.filter(cmd => {
        const words = cmd.command.toLowerCase().split(' ');
        return words.some(word => cleanText.includes(word));
      });
      
      if (possibleCommands.length === 1) {
        possibleCommands[0].action();
        announcer.announceSuccess(`Command executed: ${possibleCommands[0].command}`);
      } else if (possibleCommands.length > 1) {
        announcer.announce(
          `Did you mean: ${possibleCommands.map(c => c.command).join(', ')}?`
        );
      } else {
        announcer.announce('Command not recognized. Say "help" for available commands.');
      }
    }
  }, [allCommands, announcer]);

  // Start listening
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setError('Failed to start voice commands');
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      announcer.announce('Voice commands deactivated');
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <>
      {/* Voice Command Button */}
      <motion.button
        onClick={isListening ? stopListening : startListening}
        className={clsx(
          "fixed bottom-4 right-4 z-40",
          "p-4 bg-white rounded-full shadow-lg border-2",
          isListening 
            ? "border-red-500 voice-command-active" 
            : "border-gray-200 hover:border-blue-500",
          "transition-all duration-200",
          className
        )}
        aria-label={isListening ? "Stop voice commands" : "Start voice commands"}
        aria-pressed={isListening}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isListening ? (
          <Mic className="w-6 h-6 text-red-500" />
        ) : (
          <MicOff className="w-6 h-6 text-gray-600" />
        )}
      </motion.button>

      {/* Transcript Display */}
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            className="fixed bottom-20 right-4 z-40"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 max-w-xs">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-blue-500 animate-pulse" />
                <p className="text-sm text-gray-700">{transcript}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed top-4 right-4 z-50"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 max-w-sm">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Commands Help */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Voice Commands Help"
              aria-modal="true"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Voice Commands
                </h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close help"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allCommands.map((cmd) => (
                  <div
                    key={cmd.command}
                    className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        "{cmd.command}"
                      </p>
                      <p className="text-xs text-gray-500">
                        {cmd.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Tip: Speak clearly and wait for the command to be recognized. 
                  Commands are processed when you pause speaking.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceCommands;