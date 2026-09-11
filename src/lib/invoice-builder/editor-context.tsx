"use client";

import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from "react";
import {
  DocumentModel,
  BaseComponent,
  DragState,
  EditorState,
  AllComponentType,
  generateId,
  createEmptyDocument,
} from "./document-model";
import {
  insertComponent,
  moveComponent,
  deleteComponent,
  updateComponentProps,
  updateComponentStyle,
  reorderComponent,
  duplicateComponent,
  serializeDocument,
  deserializeDocument,
} from "./document-operations";

interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  selectComponent: (id: string | null) => void;
  insertComponent: (type: AllComponentType, parentId: string, index: number, overrides?: Partial<BaseComponent>) => void;
  moveComponent: (componentId: string, newParentId: string, newIndex: number) => void;
  deleteComponent: (componentId: string) => void;
  updateProps: (componentId: string, props: Record<string, unknown>) => void;
  updateStyle: (componentId: string, style: Record<string, unknown>) => void;
  updateComponentProps: (componentId: string, props: Record<string, unknown>) => void;
  updateComponentStyle: (componentId: string, style: Record<string, unknown>) => void;
  reorderComponent: (componentId: string, newIndex: number) => void;
  duplicateComponent: (componentId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setDocument: (document: DocumentModel) => void;
  newDocument: (name: string, invoiceType: string) => void;
  exportDocument: () => string;
  importDocument: (json: string) => void;
  startDrag: (dragState: Partial<DragState>) => void;
  endDrag: () => void;
  updateDragTarget: (targetId: string | null, position: "before" | "after" | "inside" | null) => void;
}

type EditorAction =
  | { type: "SELECT"; payload: string | null }
  | { type: "INSERT_COMPONENT"; payload: { componentType: AllComponentType; parentId: string; index: number; overrides?: Partial<BaseComponent> } }
  | { type: "MOVE_COMPONENT"; payload: { componentId: string; newParentId: string; newIndex: number } }
  | { type: "DELETE_COMPONENT"; payload: string }
  | { type: "UPDATE_PROPS"; payload: { componentId: string; props: Record<string, unknown> } }
  | { type: "UPDATE_STYLE"; payload: { componentId: string; style: Record<string, unknown> } }
  | { type: "REORDER_COMPONENT"; payload: { componentId: string; newIndex: number } }
  | { type: "DUPLICATE_COMPONENT"; payload: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_DOCUMENT"; payload: DocumentModel }
  | { type: "NEW_DOCUMENT"; payload: { name: string; invoiceType: string } }
  | { type: "IMPORT_DOCUMENT"; payload: string }
  | { type: "START_DRAG"; payload: Partial<DragState> }
  | { type: "END_DRAG" }
  | { type: "UPDATE_DRAG_TARGET"; payload: { targetId: string | null; position: "before" | "after" | "inside" | null } }
  | { type: "SET_DIRTY"; payload: boolean };

const initialDragState: DragState = {
  activeId: null,
  activeType: null,
  componentType: null,
  originalParentId: null,
  originalIndex: null,
  currentTargetId: null,
  insertPosition: null,
  placeholderId: null,
};

const initialState: EditorState = {
  document: createEmptyDocument("Untitled", "STANDARD"),
  selectedId: null,
  dragState: initialDragState,
  history: [],
  historyIndex: -1,
  isDirty: false,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SELECT":
      return { ...state, selectedId: action.payload };

    case "INSERT_COMPONENT": {
      const { componentType, parentId, index, overrides } = action.payload;
      const newDoc = insertComponent(state.document, componentType, parentId, index, overrides);
      return {
        ...state,
        document: newDoc,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "MOVE_COMPONENT": {
      const { componentId, newParentId, newIndex } = action.payload;
      const newDoc = moveComponent(state.document, componentId, newParentId, newIndex);
      return {
        ...state,
        document: newDoc,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "DELETE_COMPONENT": {
      const newDoc = deleteComponent(state.document, action.payload);
      const newSelectedId = state.selectedId === action.payload ? null : state.selectedId;
      return {
        ...state,
        document: newDoc,
        selectedId: newSelectedId,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "UPDATE_PROPS": {
      const { componentId, props } = action.payload;
      const newDoc = updateComponentProps(state.document, componentId, props);
      return {
        ...state,
        document: newDoc,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "UPDATE_STYLE": {
      const { componentId, style } = action.payload;
      const newDoc = updateComponentStyle(state.document, componentId, style);
      return {
        ...state,
        document: newDoc,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "REORDER_COMPONENT": {
      const { componentId, newIndex } = action.payload;
      const newDoc = reorderComponent(state.document, componentId, newIndex);
      return {
        ...state,
        document: newDoc,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "DUPLICATE_COMPONENT": {
      const newDoc = duplicateComponent(state.document, action.payload);
      return {
        ...state,
        document: newDoc,
        history: state.history.slice(0, state.historyIndex + 1).concat(state.document),
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "UNDO": {
      if (state.historyIndex < 0) return state;
      return {
        ...state,
        document: state.history[state.historyIndex],
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      return {
        ...state,
        document: state.history[state.historyIndex + 2],
        historyIndex: state.historyIndex + 1,
        isDirty: true,
      };
    }

    case "SET_DOCUMENT": {
      return {
        ...state,
        document: action.payload,
        selectedId: null,
        history: [],
        historyIndex: -1,
        isDirty: false,
      };
    }

    case "NEW_DOCUMENT": {
      const newDoc = createEmptyDocument(action.payload.name, action.payload.invoiceType);
      return {
        ...state,
        document: newDoc,
        selectedId: null,
        history: [],
        historyIndex: -1,
        isDirty: false,
      };
    }

    case "IMPORT_DOCUMENT": {
      const newDoc = deserializeDocument(action.payload);
      return {
        ...state,
        document: newDoc,
        selectedId: null,
        history: [],
        historyIndex: -1,
        isDirty: false,
      };
    }

    case "START_DRAG": {
      return {
        ...state,
        dragState: { ...state.dragState, ...action.payload },
      };
    }

    case "END_DRAG": {
      return {
        ...state,
        dragState: initialDragState,
      };
    }

    case "UPDATE_DRAG_TARGET": {
      return {
        ...state,
        dragState: {
          ...state.dragState,
          currentTargetId: action.payload.targetId,
          insertPosition: action.payload.position,
        },
      };
    }

    case "SET_DIRTY": {
      return { ...state, isDirty: action.payload };
    }

    default:
      return state;
  }
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children, initialDocument }: { children: ReactNode; initialDocument?: DocumentModel }) {
  const [state, dispatch] = useReducer(editorReducer, initialState, (init) =>
    initialDocument ? { ...init, document: initialDocument, isDirty: false } : init
  );

  const selectComponent = useCallback((id: string | null) => {
    dispatch({ type: "SELECT", payload: id });
  }, []);

  const insert = useCallback(
    (componentType: AllComponentType, parentId: string, index: number, overrides?: Partial<BaseComponent>) => {
      dispatch({ type: "INSERT_COMPONENT", payload: { componentType, parentId, index, overrides } });
    },
    []
  );

  const move = useCallback((componentId: string, newParentId: string, newIndex: number) => {
    dispatch({ type: "MOVE_COMPONENT", payload: { componentId, newParentId, newIndex } });
  }, []);

  const remove = useCallback((componentId: string) => {
    dispatch({ type: "DELETE_COMPONENT", payload: componentId });
  }, []);

  const updateProps = useCallback((componentId: string, props: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_PROPS", payload: { componentId, props } });
  }, []);

  const updateStyle = useCallback((componentId: string, style: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_STYLE", payload: { componentId, style } });
  }, []);

  const reorder = useCallback((componentId: string, newIndex: number) => {
    dispatch({ type: "REORDER_COMPONENT", payload: { componentId, newIndex } });
  }, []);

  const duplicate = useCallback((componentId: string) => {
    dispatch({ type: "DUPLICATE_COMPONENT", payload: componentId });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const setDocument = useCallback((document: DocumentModel) => {
    dispatch({ type: "SET_DOCUMENT", payload: document });
  }, []);

  const newDocument = useCallback((name: string, invoiceType: string) => {
    dispatch({ type: "NEW_DOCUMENT", payload: { name, invoiceType } });
  }, []);

  const exportDocument = useCallback(() => {
    return serializeDocument(state.document);
  }, [state.document]);

  const importDocument = useCallback((json: string) => {
    dispatch({ type: "IMPORT_DOCUMENT", payload: json });
  }, []);

  const startDrag = useCallback((dragState: Partial<DragState>) => {
    dispatch({ type: "START_DRAG", payload: dragState });
  }, []);

  const endDrag = useCallback(() => {
    dispatch({ type: "END_DRAG" });
  }, []);

  const updateDragTarget = useCallback((targetId: string | null, position: "before" | "after" | "inside" | null) => {
    dispatch({ type: "UPDATE_DRAG_TARGET", payload: { targetId, position } });
  }, []);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      selectComponent,
      insertComponent: insert,
      moveComponent: move,
      deleteComponent: remove,
      updateProps,
      updateStyle,
      updateComponentProps: updateProps,
      updateComponentStyle: updateStyle,
      reorderComponent: reorder,
      duplicateComponent: duplicate,
      undo,
      redo,
      canUndo: state.historyIndex >= 0,
      canRedo: state.historyIndex < state.history.length - 1,
      setDocument,
      newDocument,
      exportDocument,
      importDocument,
      startDrag,
      endDrag,
      updateDragTarget,
    }),
    [
      state,
      selectComponent,
      insert,
      move,
      remove,
      updateProps,
      updateStyle,
      reorder,
      duplicate,
      undo,
      redo,
      setDocument,
      newDocument,
      exportDocument,
      importDocument,
      startDrag,
      endDrag,
      updateDragTarget,
    ]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
}

export function useDocument(): DocumentModel {
  return useEditor().state.document;
}

export function useSelectedComponent(): BaseComponent | null {
  const { state } = useEditor();
  if (!state.selectedId) return null;
  return state.document.components.get(state.selectedId) ?? null;
}

export function useComponent(componentId: string): BaseComponent | undefined {
  const document = useDocument();
  return document.components.get(componentId);
}

export function useChildren(componentId: string): BaseComponent[] {
  const document = useDocument();
  const component = document.components.get(componentId);
  if (!component?.children) return [];
  return component.children.map((id) => document.components.get(id)!).filter(Boolean);
}