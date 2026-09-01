"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle, XCircle, Package, Image as ImageIcon, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingAnimation } from "@/components/shared/loading-animation";
import { cdnUrl } from "@/lib/cdn-url";
import { useT } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PendingProduct {
  id: string;
  title: string;
  price: number;
  category: string;
  sellerName: string;
  image: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PendingProductsPanel() {
  const t = useT();

  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  /* ---- fetch pending products ---- */
  const fetchPendingProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pending-products");
      if (!res.ok) throw new Error("Failed to fetch pending products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products ?? []);
    } catch (err) {
      console.error(err);
      toast.error("পেন্ডিং প্রোডাক্ট লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingProducts();
  }, [fetchPendingProducts]);

  /* ---- approve / reject ---- */
  const handleAction = async (productId: string, action: "approve" | "reject") => {
    setActionInProgress(productId);
    try {
      const res = await fetch("/api/admin/pending-products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, action }),
      });

      if (!res.ok) throw new Error("Action failed");

      // Remove from local list
      setProducts((prev) => prev.filter((p) => p.id !== productId));

      toast.success(
        action === "approve"
          ? "প্রোডাক্ট অনুমোদিত হয়েছে"
          : "প্রোডাক্ট বাতিল করা হয়েছে"
      );
    } catch (err) {
      console.error(err);
      toast.error("অ্যাকশন সম্পন্ন করতে সমস্যা হয়েছে");
    } finally {
      setActionInProgress(null);
    }
  };

  /* ---- helpers ---- */
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  /* ---- loading state ---- */
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingAnimation />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* ---- Page Header ---- */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("pending_products_title") || "পেন্ডিং প্রোডাক্ট"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("pending_products_subtitle") || "সেলারদের জমা দেওয়া পণ্য অনুমোদন করুন"}
        </p>
      </motion.div>

      {/* ---- Empty State ---- */}
      {products.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-border/50 shadow-sm flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <Package className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("no_pending_products") || "কোনো পেন্ডিং প্রোডাক্ট নেই"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {t("no_pending_products_desc") ||
              "সমস্ত জমা দেওয়া পণ্য ইতিমধ্যে রিভিউ করা হয়েছে।"}
          </p>
        </motion.div>
      )}

      {/* ---- Products Grid ---- */}
      {products.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              className="group bg-white dark:bg-zinc-900 rounded-2xl border border-border/50 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
            >
              {/* Image */}
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {product.image ? (
                  <img
                    src={cdnUrl(product.image)}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="space-y-3 p-4">
                {/* Category badge */}
                {product.category && (
                  <Badge variant="secondary" className="text-xs">
                    {product.category}
                  </Badge>
                )}

                {/* Title */}
                <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                  {product.title}
                </h3>

                {/* Meta row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ৳{product.price.toLocaleString("bn-BD")}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">{formatDate(product.createdAt)}</span>
                  </span>
                </div>

                {/* Seller */}
                {product.sellerName && (
                  <p className="text-xs text-muted-foreground">
                    {t("seller") || "সেলার"}: {product.sellerName}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={actionInProgress === product.id}
                    onClick={() => handleAction(product.id, "approve")}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    {t("approve") || "অনুমোদন"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={actionInProgress === product.id}
                    onClick={() => handleAction(product.id, "reject")}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    {t("reject") || "বাতিল"}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}