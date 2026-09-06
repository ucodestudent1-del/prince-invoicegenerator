"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";
import { createProjectDocument } from "@/lib/actions/projects";

const DOCUMENT_CATEGORIES = [
  "CONTRACT",
  "SUBPLANS",
  "PERMITS",
  "INVOICES",
  "PHOTOS",
  "REPORTS",
  "OTHER",
] as const;

export function DocumentUploadForm({ projectId }: { projectId: string }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("OTHER");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e["target"]["files"]?.[0];
    if (file) {
      setSelectedFile(file);
      if (!name) setName(file["name"]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: selectedFile["name"],
          contentType: selectedFile["type"],
          size: selectedFile["size"],
        }),
      });

      if (!res["ok"]) {
        const err = await res["json"]();
        throw new Error(err["error"] ?? "Upload failed");
      }

      const { uploadUrl, key, url, contentType } = await res["json"]();

      await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": contentType },
      });

      await createProjectDocument({
        projectId,
        name: name || selectedFile["name"],
        description: description || undefined,
        category: category || "OTHER",
        r2Key: key,
        url,
        contentType: contentType || undefined,
        size: selectedFile["size"],
      });

      window["location"]?.reload();
    } catch (err: any) {
      alert(err?.["message"] ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Label htmlFor="doc-file">File</Label>
          <Input
            id="doc-file"
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
      {selectedFile && (
        <>
          <div>
            <Label htmlFor="doc-name">Name</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e["target"]["value"])}
              placeholder="Document name"
              disabled={uploading}
            />
          </div>
          <div>
            <Label htmlFor="doc-description">Description</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e["target"]["value"])}
              placeholder="Optional description"
              disabled={uploading}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="doc-category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={uploading}>
              <SelectTrigger id="doc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES["map"]((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
