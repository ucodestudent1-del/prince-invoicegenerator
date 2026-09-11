import {
  DocumentModel,
  BaseComponent,
  AllComponentType,
  DragState,
  EditorState,
  generateId,
  createEmptyDocument,
  createSectionComponent,
  createRowComponent,
  createColumnComponent,
} from "./document-model";
import { componentRegistry, createComponent } from "./component-registry";

export interface DocumentOperation {
  type: "insert" | "move" | "delete" | "updateProps" | "updateStyle" | "reorder";
  componentId?: string;
  parentId?: string;
  targetId?: string;
  index?: number;
  componentType?: AllComponentType;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  previousState?: Partial<BaseComponent>;
}

export function insertComponent(
  document: DocumentModel,
  componentType: AllComponentType,
  parentId: string,
  index: number,
  overrides?: Partial<BaseComponent>
): DocumentModel {
  const parent = document.components.get(parentId);
  if (!parent) throw new Error(`Parent component ${parentId} not found`);

  const parentSchema = componentRegistry[parent.type];
  if (!parentSchema?.allowedChildren?.includes(componentType)) {
    throw new Error(`Component ${componentType} not allowed in ${parent.type}`);
  }

  const newComponent = createComponent(componentType, parentId, overrides);
  const newComponents = new Map(document.components);
  newComponents.set(newComponent.id, newComponent);

  const newParent = { ...parent, children: [...(parent.children || [])] };
  newParent.children.splice(index, 0, newComponent.id);
  newComponents.set(parentId, newParent);

  const newRootIds = parent.parentId ? document.rootIds : [...document.rootIds];
  if (!parent.parentId && !newRootIds.includes(newComponent.id)) {
    const rootIndex = document.rootIds.indexOf(parentId);
    if (rootIndex >= 0) {
      newRootIds.splice(rootIndex + 1, 0, newComponent.id);
    }
  }

  return {
    ...document,
    components: newComponents,
    rootIds: newRootIds,
    version: document.version + 1,
    updatedAt: new Date(),
  };
}

export function moveComponent(
  document: DocumentModel,
  componentId: string,
  newParentId: string,
  newIndex: number
): DocumentModel {
  const component = document.components.get(componentId);
  const newParent = document.components.get(newParentId);
  const oldParentId = component?.parentId;
  const oldParent = oldParentId ? document.components.get(oldParentId) : null;

  if (!component || !newParent) throw new Error("Component or new parent not found");

  const newParentSchema = componentRegistry[newParent.type];
  if (!newParentSchema?.allowedChildren?.includes(component.type as AllComponentType)) {
    throw new Error(`Component ${component.type} not allowed in ${newParent.type}`);
  }

  const newComponents = new Map(document.components);

  if (oldParent) {
    const oldChildren = [...(oldParent.children || [])];
    const oldIndex = oldChildren.indexOf(componentId);
    if (oldIndex >= 0) oldChildren.splice(oldIndex, 1);
    newComponents.set(oldParentId!, { ...oldParent, children: oldChildren });
  } else {
    const rootIndex = document.rootIds.indexOf(componentId);
    if (rootIndex >= 0) {
      const newRootIds = [...document.rootIds];
      newRootIds.splice(rootIndex, 1);
      newComponents.set(componentId, { ...component, parentId: newParentId });
      return {
        ...document,
        components: newComponents,
        rootIds: newRootIds,
        version: document.version + 1,
        updatedAt: new Date(),
      };
    }
  }

  const newChildren = [...(newParent.children || [])];
  newChildren.splice(newIndex, 0, componentId);
  newComponents.set(newParentId, { ...newParent, children: newChildren });
  newComponents.set(componentId, { ...component, parentId: newParentId });

  return {
    ...document,
    components: newComponents,
    version: document.version + 1,
    updatedAt: new Date(),
  };
}

export function deleteComponent(document: DocumentModel, componentId: string): DocumentModel {
  const component = document.components.get(componentId);
  if (!component) throw new Error(`Component ${componentId} not found`);

  const newComponents = new Map(document.components);
  const idsToDelete = [componentId, ...getAllDescendantIds(document, componentId)];

  for (const id of idsToDelete) {
    newComponents.delete(id);
  }

  if (component.parentId) {
    const parent = newComponents.get(component.parentId);
    if (parent) {
      const newChildren = (parent.children || []).filter((id) => id !== componentId);
      newComponents.set(component.parentId, { ...parent, children: newChildren });
    }
  } else {
    const newRootIds = document.rootIds.filter((id) => id !== componentId);
    return {
      ...document,
      components: newComponents,
      rootIds: newRootIds,
      version: document.version + 1,
      updatedAt: new Date(),
    };
  }

  return {
    ...document,
    components: newComponents,
    version: document.version + 1,
    updatedAt: new Date(),
  };
}

export function updateComponentProps(
  document: DocumentModel,
  componentId: string,
  props: Record<string, unknown>
): DocumentModel {
  const component = document.components.get(componentId);
  if (!component) throw new Error(`Component ${componentId} not found`);

  const schema = componentRegistry[component.type];
  if (schema) {
    const validation = schema.schema.safeParse(props);
    if (!validation.success) {
      throw new Error(`Invalid props: ${validation.error.message}`);
    }
  }

  const newComponents = new Map(document.components);
  newComponents.set(componentId, { ...component, props: { ...component.props, ...props } });

  return {
    ...document,
    components: newComponents,
    version: document.version + 1,
    updatedAt: new Date(),
  };
}

export function updateComponentStyle(
  document: DocumentModel,
  componentId: string,
  style: Record<string, unknown>
): DocumentModel {
  const component = document.components.get(componentId);
  if (!component) throw new Error(`Component ${componentId} not found`);

  const newComponents = new Map(document.components);
  newComponents.set(componentId, { ...component, style: { ...component.style, ...style } });

  return {
    ...document,
    components: newComponents,
    version: document.version + 1,
    updatedAt: new Date(),
  };
}

export function reorderComponent(
  document: DocumentModel,
  componentId: string,
  newIndex: number
): DocumentModel {
  const component = document.components.get(componentId);
  if (!component) throw new Error(`Component ${componentId} not found`);

  const parentId = component.parentId;
  const parent = parentId ? document.components.get(parentId) : null;

  if (parent) {
    const newComponents = new Map(document.components);
    const newChildren = [...(parent.children || [])];
    const oldIndex = newChildren.indexOf(componentId);
    if (oldIndex >= 0 && parentId) {
      newChildren.splice(oldIndex, 1);
      newChildren.splice(newIndex, 0, componentId);
      newComponents.set(parentId, { ...parent, children: newChildren });
      return {
        ...document,
        components: newComponents,
        version: document.version + 1,
        updatedAt: new Date(),
      };
    }
  } else {
    const rootIndex = document.rootIds.indexOf(componentId);
    if (rootIndex >= 0) {
      const newRootIds = [...document.rootIds];
      newRootIds.splice(rootIndex, 1);
      newRootIds.splice(newIndex, 0, componentId);
      return {
        ...document,
        rootIds: newRootIds,
        version: document.version + 1,
        updatedAt: new Date(),
      };
    }
  }

  return document;
}

export function duplicateComponent(
  document: DocumentModel,
  componentId: string
): DocumentModel {
  const component = document.components.get(componentId);
  if (!component) throw new Error(`Component ${componentId} not found`);

  const parentId = component.parentId;
  const index = parentId
    ? (document.components.get(parentId)?.children || []).indexOf(componentId) ?? 0
    : document.rootIds.indexOf(componentId);

  if (index < 0) throw new Error("Could not determine insertion index");

  const duplicated = deepCloneComponent(document, component, generateId("dup"));
  const newComponents = new Map(document.components);
  newComponents.set(duplicated.id, duplicated);

  if (parentId) {
    const parent = newComponents.get(parentId)!;
    const newChildren = [...(parent.children || [])];
    newChildren.splice(index + 1, 0, duplicated.id);
    newComponents.set(parentId, { ...parent, children: newChildren });
  } else {
    const newRootIds = [...document.rootIds];
    newRootIds.splice(index + 1, 0, duplicated.id);
    return {
      ...document,
      components: newComponents,
      rootIds: newRootIds,
      version: document.version + 1,
      updatedAt: new Date(),
    };
  }

  return {
    ...document,
    components: newComponents,
    version: document.version + 1,
    updatedAt: new Date(),
  };
}

function getAllDescendantIds(document: DocumentModel, componentId: string): string[] {
  const component = document.components.get(componentId);
  if (!component?.children?.length) return [];

  const ids: string[] = [];
  for (const childId of component.children) {
    ids.push(childId);
    ids.push(...getAllDescendantIds(document, childId));
  }
  return ids;
}

function deepCloneComponent(
  document: DocumentModel,
  component: BaseComponent,
  newId: string
): BaseComponent {
  const cloned: BaseComponent = {
    ...component,
    id: newId,
    children: [],
  };

  if (component.children?.length) {
    for (const childId of component.children) {
      const child = document.components.get(childId);
      if (child) {
        const childId_new = generateId("dup");
        const clonedChild = deepCloneComponent(document, child, childId_new);
        cloned.children!.push(clonedChild.id);
        // We'll add the cloned child to the document separately
      }
    }
  }

  return cloned;
}

export function createDefaultInvoiceDocument(invoiceType: string): DocumentModel {
  const doc = createEmptyDocument("New Invoice", invoiceType);

  const section = createSectionComponent(generateId("sec"), undefined);
  const row = createRowComponent(generateId("row"), section.id);
  const column = createColumnComponent(generateId("col"), row.id);

  const components = new Map(doc.components);
  components.set(section.id, section);
  components.set(row.id, row);
  components.set(column.id, column);

  return {
    ...doc,
    components,
    rootIds: [section.id],
  };
}

export function serializeDocument(document: DocumentModel): string {
  const serializable = {
    ...document,
    components: Object.fromEntries(document.components),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
  return JSON.stringify(serializable, null, 2);
}

export function deserializeDocument(json: string): DocumentModel {
  const parsed = JSON.parse(json);
  return {
    ...parsed,
    components: new Map(Object.entries(parsed.components)),
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
  };
}

export function getComponentPath(document: DocumentModel, componentId: string): string[] {
  const path: string[] = [];
  let current: BaseComponent | undefined = document.components.get(componentId);

  while (current) {
    path.unshift(current.id);
    current = current.parentId ? document.components.get(current.parentId) : undefined;
  }

  return path;
}

export function getComponentAtPath(document: DocumentModel, path: string[]): BaseComponent | undefined {
  if (path.length === 0) return undefined;
  let current = document.components.get(path[0]);
  for (let i = 1; i < path.length && current; i++) {
    current = document.components.get(path[i]);
  }
  return current;
}

export function findDropTarget(
  document: DocumentModel,
  clientX: number,
  clientY: number,
  containerRect: DOMRect
): { componentId: string; position: "before" | "after" | "inside" } | null {
  // This would be implemented with actual DOM measurement
  // For now, return null - the actual implementation uses dnd-kit's collision detection
  return null;
}