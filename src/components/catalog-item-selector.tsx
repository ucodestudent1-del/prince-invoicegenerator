"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Search, Star } from "lucide-react";

export interface CatalogItemForInvoice {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  unit: string;
  taxRate: number;
  taxCategory?: string | null;
  sku?: string | null;
  discount: number;
  isFavorite?: boolean;
}

interface CatalogItemSelectorProps {
  onSelect: (item: CatalogItemForInvoice) => void;
  onCreateNew?: (name: string, price: number) => void;
  trigger?: React.ReactNode;
  unitType?: string;
}

export function CatalogItemSelector({
  onSelect,
  onCreateNew,
  trigger,
  unitType,
}: CatalogItemSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [items, setItems] = React.useState<CatalogItemForInvoice[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showQuickCreate, setShowQuickCreate] = React.useState(false);
  const [quickName, setQuickName] = React.useState("");
  const [quickPrice, setQuickPrice] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  async function fetchItems(query: string) {
    if (!open) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (unitType) params.set("unit", unitType);
      params.set("limit", "100");
      const res = await fetch(`/api/catalog/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error("Failed to fetch catalog items", err);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => fetchItems(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [open, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSelect = (item: CatalogItemForInvoice) => {
    onSelect(item);
    setOpen(false);
    setSearchQuery("");
  };

  const handleQuickCreate = () => {
    if (quickName && quickPrice) {
      onCreateNew?.(quickName, Number(quickPrice));
      setOpen(false);
      setShowQuickCreate(false);
      setQuickName("");
      setQuickPrice("");
    }
  };

  return (
    <>
      <div>
        {trigger !== undefined ? (
          trigger
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Search className="h-4 w-4 mr-1" />
            Browse Catalog
          </Button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="Search items by name, SKU, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[50vh]">
              {loading ? (
                <div className="p-6 text-center text-muted-foreground">
                  Loading...
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No items found.
                </div>
              ) : (
                <div className="py-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelect(item)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {item.isFavorite && (
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          )}
                          <span className="font-medium">{item.name}</span>
                          <span className="text-lg font-bold text-right ml-auto">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {item.unit}
                          </Badge>
                          {item.sku && <span>SKU: {item.sku}</span>}
                          {item.taxRate > 0 && <span>Tax: {item.taxRate}%</span>}
                          {item.discount > 0 && <span>Discount: {item.discount}%</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!showQuickCreate ? (
              <div className="p-3 border-t bg-gray-50 text-center">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setShowQuickCreate(true)}
                >
                  + Create new item from this selection
                </button>
              </div>
            ) : (
              <div className="p-4 border-t bg-gray-50 space-y-3">
                <Input
                  placeholder="Item name"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  autoFocus
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={quickPrice}
                  onChange={(e) => setQuickPrice(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickCreate(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleQuickCreate}
                    disabled={!quickName || !quickPrice}
                  >
                    Create & Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
