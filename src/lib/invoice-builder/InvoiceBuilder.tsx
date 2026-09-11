"use client";

import React, { useState } from "react";
import { EditorProvider } from "./editor-context";
import { InvoiceBuilderPalette } from "./components/InvoiceBuilderPalette";
import { InvoiceBuilderCanvas } from "./components/InvoiceBuilderCanvas";
import { InvoiceBuilderInspector } from "./components/InvoiceBuilderInspector";
import { InvoiceBuilderToolbar } from "./components/InvoiceBuilderToolbar";
import { createDefaultInvoiceDocument } from "./document-operations";

export function InvoiceBuilder({ invoiceType = "STANDARD" }: { invoiceType?: string }) {
  const [document, setDocument] = useState(() => createDefaultInvoiceDocument(invoiceType));

  return (
    <EditorProvider initialDocument={document}>
      <div className="h-screen flex flex-col bg-gray-50">
        <InvoiceBuilderToolbar />
        <div className="flex-1 flex overflow-hidden">
          <InvoiceBuilderPalette />
          <div className="flex-1 flex flex-col overflow-hidden">
            <InvoiceBuilderCanvas />
          </div>
          <InvoiceBuilderInspector />
        </div>
      </div>
    </EditorProvider>
  );
}

export function InvoiceBuilderFullPage({ invoiceType = "STANDARD" }: { invoiceType?: string }) {
  const [document, setDocument] = useState(() => createDefaultInvoiceDocument(invoiceType));

  return (
    <EditorProvider initialDocument={document}>
      <div className="h-screen flex flex-col bg-gray-50">
        <InvoiceBuilderToolbar />
        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r bg-white flex-shrink-0 hidden lg:block">
            <InvoiceBuilderPalette />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <InvoiceBuilderCanvas />
          </div>
          <div className="w-80 border-l bg-white flex-shrink-0 hidden xl:block">
            <InvoiceBuilderInspector />
          </div>
        </div>
      </div>
    </EditorProvider>
  );
}