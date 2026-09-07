"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemplateCustomizer } from "@/components/template-customizer";
import type { InvoiceTemplateConfig } from "@/lib/invoice-template-config";
import { getDefaultTemplate } from "@/lib/invoice-template-config";
import type { InvoiceType } from "@prisma/client";
import { Plus, Edit3, Copy, Trash2, Download, Upload } from "lucide-react";
import { getTypeLabel } from "@/lib/invoice-types";

interface TemplateManagerProps {
  templates: any[];
  org?: any;
  locale?: string;
}

export function TemplateManager({ templates, org, locale = "en" }: TemplateManagerProps) {
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplateConfig | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const handleCreateNew = (invoiceType: InvoiceType) => {
    setEditingTemplate(getDefaultTemplate(invoiceType));
    setShowCustomizer(true);
  };

  const handleEdit = (template: any) => {
    if (template.config) {
      setEditingTemplate(template.config);
    } else {
      setEditingTemplate(getDefaultTemplate(template.invoiceType));
    }
    setShowCustomizer(true);
  };

  const handleSave = (template: InvoiceTemplateConfig) => {
    console.log("Saving template:", template);
    setShowCustomizer(false);
    setEditingTemplate(null);
  };

  const handleCancel = () => {
    setShowCustomizer(false);
    setEditingTemplate(null);
  };

  if (showCustomizer && editingTemplate) {
    return (
      <div className="h-[calc(100vh-120px)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {editingTemplate.id.startsWith("default") ? "Custom New Template" : editingTemplate.name}
          </h2>
          <Button variant="outline" onClick={handleCancel}>
            Back to List
          </Button>
        </div>
        <TemplateCustomizer
          initialTemplate={editingTemplate}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Templates</h2>
        <Button onClick={() => { setEditingTemplate(getDefaultTemplate("STANDARD")); setShowCustomizer(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id || template.name}>
            <CardHeader>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <Badge variant="outline">
                {getTypeLabel(template.invoiceType || template.type || "STANDARD", (key: string) => key)}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {template.description || "Custom invoice template"}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(template)}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <Copy className="h-4 w-4" />
                </Button>
                {!template.isSystem && (
                  <Button size="sm" variant="ghost" color="error">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
