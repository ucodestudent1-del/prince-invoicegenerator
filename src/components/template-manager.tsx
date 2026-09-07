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
import { Plus, Edit3, Copy, Trash2 } from "lucide-react";
import { getTypeLabel } from "@/lib/invoice-types";
import { createTemplate, updateTemplate, deleteTemplate } from "@/lib/actions/templates";
import { useTranslations } from "next-intl";

interface TemplateManagerProps {
  templates: any[];
  org?: any;
  locale?: string;
}

export function TemplateManager({ templates, org, locale = "en" }: TemplateManagerProps) {
  const t = useTranslations("invoiceTemplates");
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplateConfig | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreateNew = (invoiceType: InvoiceType) => {
    setEditingTemplate(getDefaultTemplate(invoiceType));
    setShowCustomizer(true);
  };

  const handleEdit = (template: any) => {
    if (template.configuration) {
      setEditingTemplate(template.configuration);
    } else {
      setEditingTemplate(getDefaultTemplate(template.invoiceType));
    }
    setShowCustomizer(true);
  };

  const handleSave = async (template: InvoiceTemplateConfig) => {
    if (!org?.id) return;
    setSaving(true);
    try {
      const isBuiltIn = !template.id || template.id.startsWith("default");
      if (isBuiltIn) {
        await createTemplate(org.id, org.ownerId ?? null, template.name, template.invoiceType, template);
      } else {
        await updateTemplate(template.id, org.id, { config: template, name: template.name });
      }
    } finally {
      setSaving(false);
      setShowCustomizer(false);
      setEditingTemplate(null);
    }
  };

  const handleCancel = () => {
    setShowCustomizer(false);
    setEditingTemplate(null);
  };

  const handleCopy = (template: any) => {
    const source = template.configuration ?? getDefaultTemplate(template.invoiceType);
    const copy: InvoiceTemplateConfig = {
      ...source,
      id: `copy_${Date.now()}`,
      name: `${source.name} (copy)`,
    };
    setEditingTemplate(copy);
    setShowCustomizer(true);
  };

  const handleDelete = async (template: any) => {
    if (!org?.id || !template.id || template.id.startsWith("default")) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeletingId(template.id);
    try {
      await deleteTemplate(template.id, org.id);
    } finally {
      setDeletingId(null);
    }
  };

  if (showCustomizer && editingTemplate) {
    return (
      <div className="h-[calc(100vh-120px)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {editingTemplate.id.startsWith("default") ? t("customNewTemplate") : editingTemplate.name}
          </h2>
          <Button variant="outline" onClick={handleCancel}>
            {t("backToList")}
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
        <h2 className="text-xl font-semibold">{t("yourTemplates")}</h2>
        <Button onClick={() => { setEditingTemplate(getDefaultTemplate("STANDARD")); setShowCustomizer(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newTemplate")}
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
                {template.description || t("customInvoiceTemplate")}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(template)}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(template)}>
                  <Copy className="h-4 w-4" />
                </Button>
                {!template.isSystem && !template.id?.startsWith("default") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(template)}
                    disabled={deletingId === template.id}
                  >
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
