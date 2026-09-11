"use client";

import React, { useState } from "react";
import { InvoiceBuilderFullPage } from "@/lib/invoice-builder/client";
import { Button } from "@/components/ui/button";
import { Download, Upload, Save, Eye, Code, Database, Layout, GitBranch, RotateCcw, Shield } from "lucide-react";

export default function InvoiceBuilderDemoPage() {
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [jsonContent, setJsonContent] = useState("");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice Builder Demo</h1>
              <p className="text-gray-600 mt-1">
                Drag-and-drop visual invoice editor with structured document model
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCode(true)}>
                <Code className="w-4 h-4 mr-2" />
                View JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main builder */}
      <InvoiceBuilderFullPage invoiceType="STANDARD" />

      {/* JSON Modal */}
      {showCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Document JSON</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCode(false)}>
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono bg-gray-100 p-4 rounded max-h-[60vh] overflow-auto">
                {jsonContent || "Select a component to see JSON structure"}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(jsonContent)}>
                Copy to Clipboard
              </Button>
              <Button onClick={() => {
                const blob = new Blob([jsonContent], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "invoice-document.json";
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Invoice Preview</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-white border rounded p-8 max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
                  <p className="text-gray-500 mt-2">Preview of generated invoice</p>
                </div>
                <div className="space-y-4 text-sm text-gray-600">
                  <p>This would render the actual invoice preview using the document model.</p>
                  <p>The preview would use the same renderers as the PDF generator.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features showcase */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Key Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon="Database"
            title="Structured Document Model"
            description="Invoice represented as JSON document (not DOM), enabling multi-format rendering (HTML, PDF, server-side)"
          />
          <FeatureCard
            icon="Layout"
            title="Three-Panel Editor"
            description="Component palette, visual canvas, and property inspector - familiar builder experience"
          />
          <FeatureCard
            icon="GitBranch"
            title="Drag & Drop"
            description="Native HTML5 drag-and-drop with dnd-kit patterns for create, reorder, and move operations"
          />
          <FeatureCard
            icon="RotateCcw"
            title="Undo/Redo History"
            description="Full history stack with 50+ step undo/redo for safe experimentation"
          />
          <FeatureCard
            icon="Shield"
            title="Zod Validation"
            description="Runtime schema validation for every component type with TypeScript inference"
          />
          <FeatureCard
            icon="Download"
            title="Import/Export"
            description="Full JSON serialization for persistence, sharing, and version control"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Database: Database,
    Layout: Layout,
    GitBranch: GitBranch,
    RotateCcw: RotateCcw,
    Shield: Shield,
    Download: Download,
  };

  const Icon = icons[icon] || Database;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}