import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface HistoryAction {
  name: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface HistoryContextType {
  pushAction: (action: HistoryAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  const pushAction = useCallback((action: HistoryAction) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    
    try {
      await action.undo();
      setRedoStack(prev => [...prev, action]);
    } catch (error) {
      console.error('Failed to undo action:', error);
    }
  }, [undoStack]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));

    try {
      await action.redo();
      setUndoStack(prev => [...prev, action]);
    } catch (error) {
      console.error('Failed to redo action:', error);
    }
  }, [redoStack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Z or Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl + Y or Cmd + Y or Ctrl + Shift + Z
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <HistoryContext.Provider value={{ 
      pushAction, 
      undo, 
      redo, 
      canUndo: undoStack.length > 0, 
      canRedo: redoStack.length > 0 
    }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
