"use client";

import * as React from "react";
import { evaluateTemplate, applyTemplateDefaults } from "@/lib/conditional-logic";
import { RenderSections } from "@/components/invoice-sections";
import type { InvoiceTemplateConfig } from "@/lib/invoice-template-config";

export interface InvoiceRendererProps {
  template: InvoiceTemplateConfig;
  data: Record<string, any>;
  locale?: string;
  org?: any;
  onChange?: (fieldId: string, value: any) => void;
  isEditor?: boolean;
  className?: string;
}

export function InvoiceRenderer({
  template,
  data,
  locale = "en",
  org,
  onChange,
  isEditor = false,
  className = "",
}: InvoiceRendererProps) {
  const evaluatedData = React.useMemo(() => {
    return applyTemplateDefaults(template, data);
  }, [template, data]);

  const { visibleSections } = React.useMemo(() => {
    return evaluateTemplate(template, evaluatedData);
  }, [template, evaluatedData]);

  if (!template) return null;

  return (
    <div className={`invoice-renderer ${className}`}>
      <RenderSections
        sections={visibleSections}
        invoice={evaluatedData}
        org={org}
        locale={locale}
        onFieldChange={onChange}
        isEditor={isEditor}
      />
    </div>
  );
}

export { RenderSections };
