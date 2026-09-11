"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BaseComponent, AllComponentType, DragState } from "./document-model";
import { componentRegistry, getComponentsByCategory } from "./component-registry";
import { useEditor } from "./editor-context";

export interface DragItem {
  type: "palette" | "canvas";
  componentType?: AllComponentType;
  componentId?: string;
  sourceId?: string;
  sourceIndex?: number;
}

export interface DropTarget {
  id: string;
  type: "component" | "container";
  accepts: AllComponentType[];
  rect: DOMRect;
}

export function useDragAndDrop() {
  const { state, startDrag, endDrag, updateDragTarget, insertComponent, moveComponent, reorderComponent } = useEditor();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | "inside" | null>(null);
  const dragItemRef = useRef<DragItem | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: DragItem) => {
      dragItemRef.current = item;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/json", JSON.stringify(item));

      const componentType = item.componentType ?? (item.componentId ? state.document.components.get(item.componentId)?.type : null);
      startDrag({
        activeId: item.componentId ?? generateId("drag"),
        activeType: item.type,
        componentType: componentType as AllComponentType,
        originalParentId: item.sourceId ?? null,
        originalIndex: item.sourceIndex ?? null,
        placeholderId: generateId("placeholder"),
      });

      if (item.type === "canvas" && item.componentId) {
        const component = state.document.components.get(item.componentId);
        if (component) {
          e.currentTarget.classList.add("dragging");
        }
      }
    },
    [state.document, startDrag]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      e.currentTarget.classList.remove("dragging");
      const item = dragItemRef.current;
      dragItemRef.current = null;

      if (item && dragOverId) {
        if (item.type === "palette" && item.componentType) {
          insertComponent(item.componentType, dragOverId, dragOverPosition === "inside" ? 0 : dragOverPosition === "before" ? 0 : 1);
        } else if (item.type === "canvas" && item.componentId && item.componentId !== dragOverId) {
          const targetComponent = state.document.components.get(dragOverId);
          if (targetComponent) {
            if (dragOverPosition === "inside") {
              moveComponent(item.componentId, dragOverId, targetComponent.children?.length ?? 0);
            } else {
              const parentId = targetComponent.parentId;
              if (parentId) {
                const parent = state.document.components.get(parentId);
                const index = parent?.children?.indexOf(dragOverId) ?? 0;
                const newIndex = dragOverPosition === "before" ? index : index + 1;
                moveComponent(item.componentId, parentId, newIndex);
              }
            }
          }
        }
      }

      endDrag();
      setDragOverId(null);
      setDragOverPosition(null);
    },
    [dragOverId, dragOverPosition, state.document, insertComponent, moveComponent, endDrag]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string, position: "before" | "after" | "inside") => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const item = dragItemRef.current;
      if (!item) return;

      if (item.type === "canvas" && item.componentId === targetId) return;

      const targetComponent = state.document.components.get(targetId);
      if (!targetComponent) return;

      const targetSchema = componentRegistry[targetComponent.type];
      const itemType = item.componentType ?? (item.componentId ? state.document.components.get(item.componentId)?.type : null);
      if (!itemType || !targetSchema?.allowedChildren?.includes(itemType)) return;

      setDragOverId(targetId);
      setDragOverPosition(position);
      updateDragTarget(targetId, position);
    },
    [state.document, updateDragTarget]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverId(null);
      setDragOverPosition(null);
      updateDragTarget(null, null);
    }
  }, [updateDragTarget]);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string, position: "before" | "after" | "inside") => {
      e.preventDefault();
      const item = dragItemRef.current;
      if (!item) return;

      if (item.type === "palette" && item.componentType) {
        insertComponent(item.componentType, targetId, position === "inside" ? 0 : position === "before" ? 0 : 1);
      } else if (item.type === "canvas" && item.componentId && item.componentId !== targetId) {
        const targetComponent = state.document.components.get(targetId);
        if (targetComponent) {
          if (position === "inside") {
            moveComponent(item.componentId, targetId, targetComponent.children?.length ?? 0);
          } else {
            const parentId = targetComponent.parentId;
            if (parentId) {
              const parent = state.document.components.get(parentId);
              const index = parent?.children?.indexOf(targetId) ?? 0;
              const newIndex = position === "before" ? index : index + 1;
              moveComponent(item.componentId, parentId, newIndex);
            }
          }
        }
      }
    },
    [state.document, insertComponent, moveComponent]
  );

  return {
    dragOverId,
    dragOverPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

function generateId(prefix = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useSortable(componentId: string) {
  const { state, reorderComponent } = useEditor();
  const component = state.document.components.get(componentId);
  const parentId = component?.parentId;
  const parent = parentId ? state.document.components.get(parentId) : null;
  const index = parent?.children?.indexOf(componentId) ?? -1;
  const siblings = parent?.children?.map((id) => state.document.components.get(id)!).filter(Boolean) ?? [];

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/json", JSON.stringify({ componentId, sourceId: parentId, sourceIndex: index }));
      e.currentTarget.classList.add("dragging");
    },
    [componentId, parentId, index]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (targetIndex !== index) {
        reorderComponent(componentId, targetIndex);
      }
    },
    [componentId, index, reorderComponent]
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove("dragging");
  }, []);

  return { handleDragStart, handleDragOver, handleDragEnd, index, siblings };
}