"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Star,
  Copy,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  duplicateCatalogItem,
  toggleCatalogItemFavorite,
} from "@/lib/actions/catalog";
import type { CatalogUnit } from "@prisma/client";

interface CatalogItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  unit: string;
  taxRate: number;
  taxCategory?: string | null;
  sku?: string | null;
  discount: number;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: any;
  updatedAt: any;
}

const unitOptions: { value: CatalogUnit; label: string }[] = [
  { value: "HOURS", label: "Hours" },
  { value: "UNITS", label: "Units" },
  { value: "FLAT_FEE", label: "Flat Fee" },
  { value: "DAYS", label: "Days" },
  { value: "PROJECTS", label: "Projects" },
];

export function CatalogManagementView({ initialItems }: { initialItems: any[] }) {
  const [items, setItems] = React.useState<CatalogItem[]>(initialItems || []);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CatalogItem | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const t = useTranslations();

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState<string | number>("0");
  const [unit, setUnit] = React.useState<CatalogUnit>("UNITS");
  const [taxRate, setTaxRate] = React.useState<string | number>("0");
  const [taxCategory, setTaxCategory] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [discount, setDiscount] = React.useState<string | number>("0");

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("0");
    setUnit("UNITS");
    setTaxRate("0");
    setTaxCategory("");
    setSku("");
    setDiscount("0");
  };

  const openEditForm = (item: CatalogItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || "");
    setPrice(item.price);
    setUnit(item.unit as CatalogUnit);
    setTaxRate(item.taxRate);
    setTaxCategory(item.taxCategory || "");
    setSku(item.sku || "");
    setDiscount(item.discount);
    setShowForm(true);
  };

  const openCreateForm = () => {
    setEditingItem(null);
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    const input = {
      name: name as string,
      description: description || null,
      price: Number(price),
      unit: unit as CatalogUnit,
      taxRate: Number(taxRate),
      taxCategory: taxCategory || null,
      sku: sku || null,
      discount: Number(discount),
    };

    try {
      if (editingItem) {
        await updateCatalogItem(editingItem.id, input);
        setItems(
          items.map((it) =>
            it.id === editingItem.id ? { ...it, ...input, id: it.id, isFavorite: it.isFavorite, sortOrder: it.sortOrder, createdAt: it.createdAt, updatedAt: new Date().toISOString() } : it
          )
        );
      } else {
        const newItem = await createCatalogItem(input);
        setItems([newItem, ...items]);
      }
      closeForm();
    } catch (err: any) {
      console.error("Failed to save item:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    try {
      await deleteCatalogItem(id);
      setItems(items.filter((it) => it.id !== id));
    } catch (err: any) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const newItem = await duplicateCatalogItem(id);
      setItems([newItem, ...items]);
    } catch (err: any) {
      console.error("Failed to duplicate item:", err);
    }
  };

  const handleToggleFavorite = async (id: string, current: boolean) => {
    try {
      await toggleCatalogItemFavorite(id, !current);
      setItems(
        items.map((it) =>
          it.id === id ? { ...it, isFavorite: !it.isFavorite } : it
        )
      );
    } catch (err: any) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Add */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" /> Add Item
        </Button>
      </div>

      {/* Catalog Table */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              No items in your catalog yet. Click &quot;Add Item&quot; to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleFavorite(item.id, item.isFavorite)}
                          className="hover:text-yellow-400 focus:outline-none"
                        >
                          {item.isFavorite ? (
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          ) : (
                            <Star className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs truncate">
                          {item.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.unit}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.sku ? <code className="text-xs">{item.sku}</code> : "—"}
                    </TableCell>
                    <TableCell>{item.taxRate}%</TableCell>
                    <TableCell>{item.discount}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFavorite(item.id, item.isFavorite)}
                          title={item.isFavorite ? "Unfavorite" : "Favorite"}
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(item.id)}
                          title="Duplicate"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditForm(item)}
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Item Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingItem ? "Edit Item" : "Add New Item"}
              </h2>
              <button
                onClick={closeForm}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Website Design, Logo Creation"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Default description shown on invoices"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Select value={unit} onValueChange={(v) => setUnit(v as CatalogUnit)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="taxCategory">Tax Category</Label>
                  <Input
                    id="taxCategory"
                    value={taxCategory}
                    onChange={(e) => setTaxCategory(e.target.value)}
                    placeholder="e.g. Services, Materials"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. WEB-001"
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Default Discount (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Saving…" : editingItem ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
