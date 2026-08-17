"use client";

import * as React from "react";
import { TemplateSelectorForm } from "@/components/template-selector";
import { TemplatePreview } from "@/components/template-preview";

export function TemplateEditor({
  current,
  brandColor,
  accentColor,
  fontFamily,
  layout,
}: {
  current: string;
  brandColor?: string;
  accentColor?: string;
  fontFamily?: string;
  layout?: string;
}) {
  const [selected, setSelected] = React.useState(current);

  return (
    <div className="space-y-6">
      <TemplateSelectorForm current={selected} onTemplateChange={setSelected} />
      <TemplatePreview
        template={selected}
        brandColor={brandColor}
        accentColor={accentColor}
        fontFamily={fontFamily}
        layout={layout}
      />
    </div>
  );
}
