"use client";

import React from "react";
import { useEditor } from "../editor-context";
import { Button } from "@/components/ui/button";
import { Undo, Redo, Download, Eye, Code, RotateCcw, Upload } from "lucide-react";

export function InvoiceBuilderToolbar() {
  const { state, undo, redo, canUndo, canRedo, exportDocument, newDocument } = useEditor();
  const [showPreview, setShowPreview] = React.useState(false);
  const [showCode, setShowCode] = React.useState(false);

  const handleExport = () => {
    const json = exportDocument();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.document.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        // Import would be handled by the editor context
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-14 border-b bg-white flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Invoice Builder</h1>
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
          {state.document.invoiceType}
        </span>
        {state.isDirty && (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
            Unsaved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-gray-200 mx-2" />

        <Button variant="outline" size="sm" onClick={handleExport} title="Export as JSON">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" title="Import JSON">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-file"
          />
          <label htmlFor="import-file" className="cursor-pointer">
            <Upload className="w-4 h-4" />
          </label>
        </Button>

        <div className="w-px h-6 bg-gray-200 mx-2" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className={showPreview ? "bg-blue-100 text-blue-700" : ""}
          title="Preview"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCode(!showCode)}
          className={showCode ? "bg-blue-100 text-blue-700" : ""}
          title="View JSON"
        >
          <Code className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => newDocument("Untitled", "STANDARD")}
          title="New Document"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          v{state.document.version} • {state.document.components.size} components
        </span>
      </div>
    </div>
  );
}