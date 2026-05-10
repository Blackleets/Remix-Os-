import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label, cn } from '../components/Common';
import {
  Plus,
  Search,
  Box,
  Trash2,
  Edit2,
  Download,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Tag,
  X,
  Crown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached, getCompanyUsage } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';
import { ImageUpload } from '../components/ImageUpload';
import { BusinessMetricsKey, useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { ProductLike, ProductSalesAggregate } from '../lib/businessMetrics';
import { toMoney } from '../lib/moneyUtils';

interface ProductFull extends ProductLike {
  description?: string;
}

type ProductFilter =
  | 'all'
  | 'active'
  | 'draft'
  | 'archived'
  | 'low_stock'
  | 'no_stock'
  | 'no_sku'
  | 'no_cost';
type SortKey = 'name' | 'price' | 'stock' | 'margin' | 'revenue' | 'sold';

const LOW_STOCK_THRESHOLD = 10;
const LOW_MARGIN_THRESHOLD = 18;

export function Products() {
  const { company, role } = useAuth();
  const { t, formatCurrency } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const { canEditProducts } = usePermissions();

  const metricsOptions = useMemo(
    () => ({ include: ['products', 'sales'] as BusinessMetricsKey[] }),
    []
  );
  const metrics = useBusinessMetrics(metricsOptions);
  const productsList = (metrics.raw.products as ProductFull[]) || [];
  const productMetrics = metrics.products;
  const isLoading = metrics.isLoading;

  const aggregateById = useMemo(() => {
    const map = new Map<string, ProductSalesAggregate>();
    if (productMetrics) {
      for (const row of productMetrics.allProductSales) {
        map.set(row.product.id, row);
      }
    }
    return map;
  }, [productMetrics]);

  const topSellerIds = useMemo(() => {
    if (!productMetrics) return new Set<string>();
    return new Set(
      productMetrics.bestSellingProducts
        .filter((row) => row.unitsSold > 0)
        .slice(0, 3)
        .map((row) => row.product.id)
    );
  }, [productMetrics]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductFull | null>(null);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const [form, setForm] = useState({
    name: '',
    price: '',
    costPrice: '',
    stockLevel: '',
    category: '',
    sku: '',
    description: '',
    status: 'active' as 'active' | 'draft' | 'archived',
    imageURL: '',
  });

  const handleCreateNew = async () => {
    if (!company) return;
    const planId = company.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    try {
      const usage = await getCompanyUsage(company.id);
      if (isLimitReached(usage.products, plan.limits.products)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    } catch (e) {
      console.warn('Plan usage check failed, falling back to local count', e);
      if (isLimitReached(productsList.length, plan.limits.products)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    }
    setSelectedProduct(null);
    setForm({
      name: '',
      price: '',
      costPrice: '',
      stockLevel: '',
      category: '',
      sku: '',
      description: '',
      status: 'active',
      imageURL: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const validate = () => {
    if (!form.name.trim()) return t('products.errors.name_required');
    const price = parseFloat(form.price);
    if (!Number.isFinite(price) || price <= 0) return t('products.errors.price_must_be_positive');
    const stock = parseInt(form.stockLevel, 10);
    if (!Number.isFinite(stock) || stock < 0) return t('products.errors.stock_negative');
    if (form.costPrice.trim() !== '') {
      const cost = parseFloat(form.costPrice);
      if (!Number.isFinite(cost) || cost < 0) return t('products.errors.cost_invalid');
    }
    const sku = form.sku.trim().toLowerCase();
    if (sku) {
      const duplicate = productsList.find(
        (p) => (p.sku || '').trim().toLowerCase() === sku && p.id !== selectedProduct?.id
      );
      if (duplicate) return t('products.errors.sku_duplicate', { sku: form.sku.trim() });
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const validation = validate();
    if (validation) {
      setFormError(validation);
      return;
    }

    setLoading(true);
    try {
      const productData: Record<string, any> = {
        name: form.name.trim(),
        price: toMoney(parseFloat(form.price) || 0),
        stockLevel: parseInt(form.stockLevel, 10) || 0,
        category: form.category.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        status: form.status,
        imageURL: form.imageURL,
      };
      if (form.costPrice.trim() !== '') {
        productData.costPrice = toMoney(parseFloat(form.costPrice) || 0);
      } else {
        productData.costPrice = null;
      }

      const batch = writeBatch(db);
      const activityRef = doc(collection(db, 'activities'));

      if (selectedProduct) {
        const productRef = doc(db, 'products', selectedProduct.id);
        batch.update(productRef, { ...productData, updatedAt: serverTimestamp() });
        batch.set(activityRef, {
          type: 'product_update',
          title: 'Product Updated',
          subtitle: `${productData.name} was modified`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      } else {
        const productRef = doc(collection(db, 'products'));
        batch.set(productRef, {
          ...productData,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
        batch.set(activityRef, {
          type: 'product_create',
          title: 'Product Created',
          subtitle: `${productData.name} added to catalog`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setFormError(null);
      setIsModalOpen(false);
      setSelectedProduct(null);
      setForm({
        name: '',
        price: '',
        costPrice: '',
        stockLevel: '',
        category: '',
        sku: '',
        description: '',
        status: 'active',
        imageURL: '',
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: ProductFull) => {
    setSelectedProduct(product);
    setForm({
      name: product.name || '',
      price: (product.price ?? '').toString(),
      costPrice: typeof product.costPrice === 'number' ? product.costPrice.toString() : '',
      stockLevel: (product.stockLevel ?? '').toString(),
      category: product.category || '',
      sku: product.sku || '',
      description: product.description || '',
      status: (product.status as any) || 'active',
      imageURL: product.imageURL || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setFormError(null);
    setForm({
      name: '',
      price: '',
      costPrice: '',
      stockLevel: '',
      category: '',
      sku: '',
      description: '',
      status: 'active',
      imageURL: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!company) return;
    if (!confirm(t('products.delete_confirm'))) return;
    try {
      const movementsSnap = await getDocs(
        query(
          collection(db, 'inventoryMovements'),
          where('companyId', '==', company.id),
          where('productId', '==', id)
        )
      );
      if (!movementsSnap.empty) {
        setFormError('This product has sales history and cannot be deleted. Mark it inactive instead.');
        return;
      }
      await deleteDoc(doc(db, 'products', id));
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete product.');
    }
  };

  const enrichedProducts = useMemo(() => {
    return productsList.map((p) => {
      const agg = aggregateById.get(p.id);
      return {
        product: p,
        unitsSold: agg?.unitsSold || 0,
        revenue: agg?.revenue || 0,
        profitPerUnit: agg?.profitPerUnit ?? null,
        stockValue: agg?.stockValue ?? null,
        marginPercent: agg?.marginPercent ?? null,
      };
    });
  }, [productsList, aggregateById]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedProducts.filter((row) => {
      const status = row.product.status || 'active';
      const stock = row.product.stockLevel ?? 0;
      const hasSku = !!row.product.sku?.trim();
      const hasCostPrice = typeof row.product.costPrice === 'number';

      if (productFilter === 'active' && status !== 'active') return false;
      if (productFilter === 'draft' && status !== 'draft') return false;
      if (productFilter === 'archived' && status !== 'archived') return false;
      if (productFilter === 'low_stock' && !(stock > 0 && stock <= LOW_STOCK_THRESHOLD)) return false;
      if (productFilter === 'no_stock' && stock > 0) return false;
      if (productFilter === 'no_sku' && hasSku) return false;
      if (productFilter === 'no_cost' && hasCostPrice) return false;

      if (term) {
        const hay = `${row.product.name || ''} ${row.product.sku || ''} ${row.product.category || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [enrichedProducts, search, productFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortKey) {
      case 'price':
        copy.sort((a, b) => (b.product.price ?? 0) - (a.product.price ?? 0));
        break;
      case 'stock':
        copy.sort((a, b) => (b.product.stockLevel ?? 0) - (a.product.stockLevel ?? 0));
        break;
      case 'margin':
        copy.sort((a, b) => (b.marginPercent ?? -Infinity) - (a.marginPercent ?? -Infinity));
        break;
      case 'sold':
        copy.sort((a, b) => b.unitsSold - a.unitsSold);
        break;
      case 'revenue':
        copy.sort((a, b) => b.revenue - a.revenue);
        break;
      case 'name':
      default:
        copy.sort((a, b) => (a.product.name || '').localeCompare(b.product.name || ''));
    }
    return copy;
  }, [filtered, sortKey]);

  const tilesData = useMemo(() => {
    const total = productsList.length;
    const active = productsList.filter((p) => (p.status || 'active') === 'active').length;
    const margins = productsList
      .map((p) => {
        if (typeof p.costPrice === 'number' && typeof p.price === 'number' && p.price > 0) {
          return ((p.price - p.costPrice) / p.price) * 100;
        }
        return null;
      })
      .filter((m): m is number => m !== null);
    const avgMargin =
      margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null;
    const topSeller = productMetrics?.bestSellingProducts.find((row) => row.unitsSold > 0) || null;
    return { total, active, avgMargin, topSeller };
  }, [productsList, productMetrics]);

  const hasActiveFilters = !!search.trim() || productFilter !== 'all';

  const renderMarginBadge = (marginPercent: number | null) => {
    if (marginPercent == null) {
      return (
        <span className="text-[10px] uppercase tracking-widest text-neutral-600 italic">-</span>
      );
    }
    const tone =
      marginPercent < 0
        ? 'bg-red-500/10 text-red-400 border-red-500/20'
        : marginPercent < LOW_MARGIN_THRESHOLD
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return (
      <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border', tone)}>
        {marginPercent.toFixed(1)}%
      </span>
    );
  };

  const renderTile = (
    key: string,
    label: string,
    value: string,
    Icon: any,
    tone: string,
    sub?: string
  ) => (
    <Card key={key} className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center', tone)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tight truncate">{value}</p>
      {sub && <p className="text-[10px] text-neutral-600 font-mono mt-1 truncate">{sub}</p>}
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="space-y-6 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-2 border-white/10 border-t-blue-500 rounded-full mx-auto"
          />
          <p className="text-xs text-neutral-500 font-mono italic">{t('common.syncing') || 'syncing'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">
            {t('products.title')}
          </h1>
          <p className="text-neutral-500 text-sm">{t('products.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="gap-2 px-6"
            onClick={() =>
              exportToCSV(
                sorted.map((row) => ({
                  ID: row.product.id,
                  Name: row.product.name || '',
                  Price: row.product.price ?? '',
                  CostPrice: typeof row.product.costPrice === 'number' ? row.product.costPrice : '',
                  MarginPercent: row.marginPercent != null ? row.marginPercent.toFixed(2) : '',
                  Stock: row.product.stockLevel ?? 0,
                  Category: row.product.category || '',
                  SKU: row.product.sku || '',
                  Status: row.product.status || '',
                  UnitsSold: row.unitsSold,
                  Revenue: row.revenue,
                })),
                'products'
              )
            }
            disabled={sorted.length === 0}
          >
            <Download className="w-4 h-4" /> {t('common.export')}
          </Button>
          {role !== 'viewer' && canEditProducts && (
            <Button onClick={handleCreateNew} className="gap-2 px-6">
              <Plus className="w-4 h-4" /> {t('products.add')}
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('products.upgrade.title')}
        message={t('products.upgrade.message')}
        limitName={t('products.limit_products') || 'Products'}
      />

      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {renderTile(
          'total',
          t('products.tiles.total_products'),
          tilesData.total.toString(),
          Box,
          'border-blue-500/20 bg-blue-500/10 text-blue-400'
        )}
        {renderTile(
          'active',
          t('products.tiles.active_products'),
          tilesData.active.toString(),
          Sparkles,
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        )}
        {renderTile(
          'avgMargin',
          t('products.tiles.avg_margin'),
          tilesData.avgMargin == null ? '-' : `${tilesData.avgMargin.toFixed(1)}%`,
          TrendingUp,
          tilesData.avgMargin == null
            ? 'border-white/[0.05] bg-white/[0.02] text-neutral-500'
            : tilesData.avgMargin < LOW_MARGIN_THRESHOLD
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
              : 'border-purple-500/20 bg-purple-500/10 text-purple-400',
          tilesData.avgMargin == null ? t('products.no_cost_warning') : undefined
        )}
        {renderTile(
          'topSeller',
          t('products.tiles.top_seller'),
          tilesData.topSeller?.product.name || t('products.tiles.no_seller'),
          Crown,
          'border-orange-500/20 bg-orange-500/10 text-orange-400',
          tilesData.topSeller
            ? t('products.tiles.revenue_label', { value: formatCurrency(tilesData.topSeller.revenue) })
            : undefined
        )}
      </div>

      <Card className="relative overflow-hidden border-white/5 bg-neutral-900/40 p-0">
        <div className="p-5 border-b border-white/[0.05] bg-white/[0.01] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="relative max-w-md group w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder={t('common.search') || 'Search...'}
                className="pl-10 h-11 bg-black/40 border-white/10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-600">
                {t('products.sort.label')}
              </span>
              <select
                aria-label={t('products.sort.label')}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 appearance-none"
              >
                <option value="name" className="bg-neutral-900">
                  {t('products.sort.name')}
                </option>
                <option value="price" className="bg-neutral-900">
                  {t('products.sort.price')}
                </option>
                <option value="stock" className="bg-neutral-900">
                  {t('products.sort.stock')}
                </option>
                <option value="margin" className="bg-neutral-900">
                  {t('products.sort.margin')}
                </option>
                <option value="revenue" className="bg-neutral-900">
                  {t('products.sort.revenue')}
                </option>
                <option value="sold" className="bg-neutral-900">
                  {t('products.sort.sold')}
                </option>
              </select>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setProductFilter('all');
                  }}
                  className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                >
                  {t('products.filters.reset')}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-neutral-600 mr-1">
              {t('products.filters.label')}
            </span>
            {([
              { value: 'all', label: t('products.filters.status_all') },
              { value: 'active', label: t('products.filters.status_active') },
              { value: 'draft', label: t('products.filters.status_draft') },
              { value: 'archived', label: t('products.filters.status_archived') },
              { value: 'low_stock', label: t('products.filters.low_stock') },
              { value: 'no_stock', label: t('products.filters.no_stock') },
              { value: 'no_sku', label: t('products.filters.no_sku') },
              { value: 'no_cost', label: t('products.filters.no_cost') },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProductFilter(opt.value as ProductFilter)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border',
                  productFilter === opt.value
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-neutral-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="table-header">{t('products.table.identity')}</th>
                <th className="table-header">{t('products.table.metadata')}</th>
                <th className="table-header">{t('products.table.price')}</th>
                <th className="table-header">{t('products.table.margin')}</th>
                <th className="table-header">{t('products.table.sales')}</th>
                <th className="table-header">{t('products.table.stock')}</th>
                <th className="table-header text-right">{t('products.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const product = row.product;
                const stock = product.stockLevel ?? 0;
                const margin = row.marginPercent;
                const isTopSeller = topSellerIds.has(product.id);
                const isLowMargin =
                  margin != null && margin < LOW_MARGIN_THRESHOLD && product.costPrice != null;
                return (
                  <motion.tr
                    key={product.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="group hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-neutral-500 group-hover:border-blue-500/50 transition-colors overflow-hidden">
                          {product.imageURL ? (
                            <img src={product.imageURL} alt={product.name || ''} className="w-full h-full object-cover" />
                          ) : (
                            <Box className="w-5 h-5 text-neutral-600 group-hover:text-blue-400 transition-colors" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-200 truncate">{product.name || '-'}</p>
                            {isTopSeller && (
                              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 inline-flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5" />
                                {t('products.badges.top_seller')}
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              'text-[9px] uppercase tracking-widest font-bold',
                              (product.status || 'active') === 'active' ? 'text-emerald-500' : 'text-neutral-500'
                            )}
                          >
                            {product.status || 'active'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-col">
                        <span className="text-neutral-400 font-medium">
                          {product.category || t('products.table.generic')}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-mono tracking-tighter uppercase">
                          {product.sku || t('products.table.no_sku')}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-white text-sm">
                      <div className="flex flex-col">
                        <span>{formatCurrency(product.price ?? 0)}</span>
                        {typeof product.costPrice === 'number' ? (
                          <>
                            <span className="text-[10px] text-neutral-600 font-mono">
                              {t('products.cost_price')} {formatCurrency(product.costPrice)}
                            </span>
                            <span className="text-[10px] text-neutral-700 font-mono">
                              {t('products.stock_value')} {formatCurrency(row.stockValue ?? 0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-neutral-700 italic font-sans">
                            {t('products.missing_cost')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-1">
                        {renderMarginBadge(margin)}
                        {margin != null && product.costPrice != null && product.price != null && (
                          <span className="text-[10px] text-neutral-600 font-mono">
                            {formatCurrency(row.profitPerUnit ?? product.price - product.costPrice)} / u
                          </span>
                        )}
                        {isLowMargin && (
                          <span className="text-[9px] uppercase tracking-widest font-bold text-amber-400/80 inline-flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> {t('products.badges.low_margin')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-200 font-bold">{row.unitsSold}</span>
                        <span className="text-[10px] text-neutral-600 font-mono">
                          {formatCurrency(row.revenue)}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-16 bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((stock / 50) * 100, 100)}%` }}
                            className={cn(
                              'h-full rounded-full',
                              stock > LOW_STOCK_THRESHOLD ? 'bg-emerald-500/50' : stock > 0 ? 'bg-amber-500/50' : 'bg-red-500/50'
                            )}
                          />
                        </div>
                        <span className="text-xs font-mono text-neutral-400">{stock}</span>
                      </div>
                      {stock <= 0 ? (
                        <span className="text-[9px] uppercase tracking-widest font-bold text-red-400 mt-1 block">
                          {t('products.badges.out_of_stock')}
                        </span>
                      ) : stock <= LOW_STOCK_THRESHOLD ? (
                        <span className="text-[9px] uppercase tracking-widest font-bold text-amber-400 mt-1 block">
                          {t('products.badges.low_stock')}
                        </span>
                      ) : null}
                    </td>
                    <td className="table-cell text-right">
                      {canEditProducts && (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <Button
                            variant="ghost"
                            className="w-9 h-9 p-0 rounded-lg"
                            onClick={() => handleEdit(product as ProductFull)}
                            aria-label="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-9 h-9 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/5"
                            onClick={() => handleDelete(product.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-white/[0.05]">
          {sorted.map((row) => {
            const product = row.product;
            const stock = product.stockLevel ?? 0;
            return (
              <div key={product.id} className="p-4 space-y-3 active:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shrink-0 overflow-hidden">
                      {product.imageURL ? (
                        <img src={product.imageURL} alt={product.name || ''} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-5 h-5 text-neutral-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-200 truncate">{product.name || '-'}</p>
                      <p className="text-[10px] text-neutral-600 font-mono truncate">
                        {product.sku || 'NO_SKU'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-white text-sm">{formatCurrency(product.price ?? 0)}</p>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                      {stock} {t('products.table.in_node')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderMarginBadge(row.marginPercent)}
                    {row.unitsSold > 0 && (
                      <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 inline-flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />
                        {row.unitsSold} - {formatCurrency(row.revenue)}
                      </span>
                    )}
                  </div>
                  {canEditProducts && (
                    <Button
                      variant="ghost"
                      className="w-8 h-8 p-0 rounded-lg"
                      onClick={() => handleEdit(product as ProductFull)}
                      aria-label="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {sorted.length === 0 && (
          <div className="py-24 text-center">
            <div className="flex flex-col items-center gap-6 text-neutral-600 max-w-sm mx-auto p-6">
              <div className="w-20 h-20 rounded-3xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.01]">
                <Box className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">{t('products.empty.title')}</p>
                <p className="text-xs leading-relaxed text-neutral-500 px-4">{t('products.empty.subtitle')}</p>
              </div>
              {canEditProducts && (
                <Button onClick={handleCreateNew} className="gap-2 px-8 h-12 shadow-xl shadow-blue-600/20">
                  <Plus className="w-4 h-4" /> {t('products.add')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black flex flex-col max-h-[92vh]"
            >
              <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">
                  {selectedProduct ? t('products.modal.title') : t('products.modal.init_title')}
                </h2>
                <button
                  type="button"
                  aria-label={t('common.close') || 'Close'}
                  onClick={handleCloseModal}
                  className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                <div className="flex gap-8 items-start mb-4">
                  <div className="w-32 shrink-0">
                    <ImageUpload
                      value={form.imageURL}
                      onChange={(url) => setForm({ ...form, imageURL: url })}
                      path={`companies/${company?.id}/products`}
                      label={t('products.modal.avatar')}
                    />
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>{t('products.name')}</Label>
                      <Input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={t('products.modal.name_placeholder')}
                      />
                    </div>
                    <div>
                      <Label>{t('products.category')}</Label>
                      <Input
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="e.g. Hardware"
                      />
                    </div>
                    <div>
                      <Label>{t('products.sku')}</Label>
                      <Input
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        placeholder="e.g. SK-1002-X"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label>{t('products.price')}</Label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>{t('products.cost_price')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costPrice}
                      onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                      placeholder={t('products.modal.cost_placeholder')}
                    />
                    <p className="text-[10px] text-neutral-600 mt-1 leading-relaxed">
                      {t('products.cost_price_hint')}
                    </p>
                  </div>
                  <div>
                    <Label>{t('products.stock')}</Label>
                    <Input
                      required
                      type="number"
                      min="0"
                      value={form.stockLevel}
                      onChange={(e) => setForm({ ...form, stockLevel: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>{t('products.status')}</Label>
                    <select
                      aria-label={t('products.status')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    >
                      <option value="active" className="bg-neutral-900">
                        {t('common.active')}
                      </option>
                      <option value="draft" className="bg-neutral-900">
                        {t('common.draft')}
                      </option>
                      <option value="archived" className="bg-neutral-900">
                        {t('common.archived')}
                      </option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Label>{t('products.modal.desc_label')}</Label>
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all min-h-[100px]"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder={t('products.modal.desc_placeholder')}
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                  <Button type="button" variant="secondary" onClick={handleCloseModal} className="px-6">
                    {t('common.abort')}
                  </Button>
                  <Button type="submit" disabled={loading} className="px-8">
                    {loading ? t('common.processing') : selectedProduct ? t('common.update') : t('products.add')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
