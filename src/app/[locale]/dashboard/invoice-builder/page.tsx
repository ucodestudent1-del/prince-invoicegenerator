"use client";

import React, { useState, useEffect } from "react";
import { InvoiceBuilder } from "@/lib/invoice-builder/client";
import { useRouter, useParams } from "next/navigation";

export default function InvoiceBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const [invoiceType, setInvoiceType] = useState("STANDARD");
  const [isLoading, setIsLoading] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (params.invoiceType) {
      setInvoiceType(params.invoiceType as string);
    }
    loadTemplates();
  }, [params.invoiceType]);

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setSavedTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const handleSaveTemplate = async (documentJson: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Custom ${invoiceType} ${new Date().toLocaleDateString()}`,
          description: `Custom invoice template for ${invoiceType}`,
          invoiceType,
          document: documentJson,
        }),
      });

      if (response.ok) {
        loadTemplates();
        alert("Template saved successfully!");
      } else {
        alert("Failed to save template");
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Failed to save template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        // The template would be loaded into the builder via context
        alert("Template loaded! (Integration needed)");
      }
    } catch (error) {
      console.error("Failed to load template:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <InvoiceBuilder invoiceType={invoiceType} />
    </div>
  );
}