import { useEffect, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { Plus, Search, Box, Trash2, Edit2, Download, Package, Radar, Sparkles, Archive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached, getCompanyUsage } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';
import { ImageUpload } from '../components/ImageUpload';
import { ImportPreview, ProductImportRow, buildProductImportPreview, chunkArray, downloadCsvTemplate, readImportFile, withImportFileName } from '../lib/importUtils';
import { EmptyStatePanel } from '../components/EmptyStatePanel';

interface ImportResultSummary {
  created: number;
  invalid: number;
  duplicates_in_file: number;
  duplicates_existing: number;
  total_processed: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
  category: string;
  sku: string;
  description?: string;
  status: 'active' | 'draft' | 'archived';
  imageURL?: string;
}

export function Products() {
  const { company, role } = useAuth();
  const { t, formatCurrency } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview<ProductImportRow> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResultSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const { canEditProducts } = usePermissions();

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const [form, setForm] = useState<{
    name: string;
    price: string;
    stockLevel: string;
    category: string;
    sku: string;
    description: string;
    status: 'active' | 'draft' | 'archived';
    imageURL: string;
  }>({
    name: '',
    price: '',
    stockLevel: '',
    category: '',
    sku: '',
    description: '',
    status: 'active',
    imageURL: '',
  });

  const handleCreateNew = async () => {
    if (!company) return;
    if (!(company as any).internalTesting) {
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
        if (isLimitReached(products.length, plan.limits.products)) {
          setIsUpgradeModalOpen(true);
          return;
        }
      }
    }
    setSelectedProduct(null);
    setForm({ name: '', price: '', stockLevel: '', category: '', sku: '', description: '', status: 'active', imageURL: '' });
    setIsModalOpen(true);
  };

  const fetchProducts = async () => {
    if (!company) return;
    try {
      const q = query(collection(db, 'products'), where('companyId', '==', company.id));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      setProducts(list);
      setProductsError(null);
    } catch (err) {
      console.error('fetchProducts failed:', err);
      setProductsError('No se pudo cargar el catálogo de productos.');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !form.name) return;

    setLoading(true);
    try {
      const productData = {
        ...form,
        price: parseFloat(form.price) || 0,
        stockLevel: parseInt(form.stockLevel) || 0,
      };

      const batch = writeBatch(db);
      const activityRef = doc(collection(db, 'activities'));

      if (selectedProduct) {
        const productRef = doc(db, 'products', selectedProduct.id);
        batch.update(productRef, {
          ...productData,
          updatedAt: serverTimestamp(),
        });
        batch.set(activityRef, {
          type: 'product_update',
          title: 'Product Updated',
          subtitle: `${form.name} was modified`,
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
          subtitle: `${form.name} added to catalog`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setFormError(null);
      setIsModalOpen(false);
      setSelectedProduct(null);
      setForm({ name: '', price: '', stockLevel: '', category: '', sku: '', description: '', status: 'active', imageURL: '' });
      fetchProducts();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el producto.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setForm({
      name: product.name,
      price: product.price.toString(),
      stockLevel: product.stockLevel.toString(),
      category: product.category || '',
      sku: product.sku || '',
      description: product.description || '',
      status: product.status || 'active',
      imageURL: product.imageURL || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setFormError(null);
    setForm({ name: '', price: '', stockLevel: '', category: '', sku: '', description: '', status: 'active', imageURL: '' });
  };

  const handleOpenImport = () => {
    setIsImportOpen((prev) => !prev);
    setImportError(null);
    setImportResult(null);
    if (isImportOpen) {
      setImportPreview(null);
    }
  };

  const handleProductImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readImportFile(file);
      const preview = buildProductImportPreview(
        parsed,
        new Set(products.map((product) => product.sku?.trim().toLowerCase()).filter(Boolean))
      );
      setImportPreview(withImportFileName(preview, file.name));
      setImportError(null);
      setImportResult(null);
    } catch (error: any) {
      setImportPreview(null);
      setImportError(error?.message || 'No se pudo leer el archivo.');
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirmProductImport = async () => {
    if (!company || !importPreview) return;

    const validRows = importPreview.rows
      .filter((row) => row.normalized && row.issues.length === 0 && row.duplicateKeys.length === 0)
      .map((row) => row.normalized as ProductImportRow);

    if (validRows.length === 0) {
      setImportError('No hay filas válidas para importar.');
      return;
    }

    if (!(company as any).internalTesting) {
      const planId = company.subscription?.planId || 'starter';
      const plan = PLANS[planId];
      try {
        const usage = await getCompanyUsage(company.id);
        if (isLimitReached(usage.products + validRows.length, plan.limits.products + 1)) {
          setIsUpgradeModalOpen(true);
          setImportError('Tu plan actual no permite importar esa cantidad de productos.');
          return;
        }
      } catch (error) {
        console.warn('Usage check failed before import', error);
        if (isLimitReached(products.length + validRows.length, plan.limits.products + 1)) {
          setIsUpgradeModalOpen(true);
          setImportError('Tu plan actual no permite importar esa cantidad de productos.');
          return;
        }
      }
    }

    setImporting(true);
    try {
      for (const chunk of chunkArray(validRows, 400)) {
        const batch = writeBatch(db);
        chunk.forEach((row) => {
          const productRef = doc(collection(db, 'products'));
          batch.set(productRef, {
            ...row,
            companyId: company.id,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      await addDoc(collection(db, 'activities'), {
        type: 'product_import',
        title: 'Importación de productos',
        subtitle: `${validRows.length} productos importados desde ${importPreview.fileName}`,
        companyId: company.id,
        createdAt: serverTimestamp(),
      });

      setImportResult({
        created: validRows.length,
        invalid: importPreview.invalidRows,
        duplicates_in_file: importPreview.duplicateInFileRows,
        duplicates_existing: importPreview.duplicateExistingRows,
        total_processed: importPreview.totalRows,
      });
      setImportError(null);
      setImportPreview(null);
      await fetchProducts();
    } catch (error: any) {
      setImportError(error?.message || 'No se pudo completar la importación.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!company) return;
    if (!confirm(t('products.delete_confirm'))) return;
    try {
      const movementsSnap = await getDocs(query(
        collection(db, 'inventoryMovements'),
        where('companyId', '==', company.id),
        where('productId', '==', id)
      ));
      if (!movementsSnap.empty) {
        setFormError('Este producto tiene historial de ventas y no se puede eliminar. Marcalo como inactivo.');
        return;
      }
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo eliminar el producto.');
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );
  const hasActiveFilters = search.trim().length > 0;

  const activeProducts = products.filter((p) => p.status === 'active').length;
  const lowStockProducts = products.filter((p) => p.stockLevel <= 10).length;

  const getStatusLabel = (status: Product['status']) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'draft':
        return 'Borrador';
      case 'archived':
        return 'Archivado';
      default:
        return status;
    }
  };

  const getStatusClasses = (status: Product['status']) => {
    switch (status) {
      case 'active':
        return 'border-emerald-400/16 bg-emerald-500/8 text-emerald-200';
      case 'draft':
        return 'border-amber-400/16 bg-amber-500/8 text-amber-200';
      case 'archived':
        return 'border-white/10 bg-white/[0.04] text-neutral-300';
      default:
        return 'border-white/10 bg-white/[0.04] text-neutral-300';
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="hero-gradient overflow-hidden rounded-[30px] border border-white/10 p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="operator-badge">
                <span className="status-dot bg-blue-400 text-blue-400" />
                Catalogo activo
              </span>
              <span className="telemetry-chip">
                <Radar className="h-3 w-3 text-blue-300" />
                Stock en vigilancia
              </span>
            </div>
            <h1 className="section-title text-4xl md:text-5xl">{t('products.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 md:text-base">
              Organiza precios, stock y disponibilidad comercial desde un solo catalogo operativo.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="h-12 gap-2 px-6"
              onClick={() => exportToCSV(products.map((p) => ({
                ID: p.id,
                Name: p.name,
                Price: p.price,
                Stock: p.stockLevel,
                Category: p.category,
                SKU: p.sku,
                Status: p.status,
              })), 'products')}
              disabled={products.length === 0}
            >
              <Download className="w-4 h-4" /> {t('common.export')}
            </Button>
            {canEditProducts && (
              <Button variant="secondary" onClick={handleOpenImport} className="h-12 gap-2 px-6">
                <Download className="w-4 h-4" /> Importar productos
              </Button>
            )}
            {role !== 'viewer' && (
              <Button onClick={handleCreateNew} className="h-12 gap-2 px-6">
                <Plus className="w-4 h-4" /> {t('products.add')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Productos</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{products.length}</p>
                <p className="mt-1 text-sm text-neutral-400">Items registrados en el catalogo.</p>
              </div>
              <Package className="h-5 w-5 text-blue-300" />
            </div>
          </div>
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Activos</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{activeProducts}</p>
                <p className="mt-1 text-sm text-neutral-400">Productos listos para vender.</p>
              </div>
              <Sparkles className="h-5 w-5 text-emerald-300" />
            </div>
          </div>
          <div className="data-tile">
            <p className="section-kicker mb-2 !text-neutral-500">Stock bajo</p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-white">{lowStockProducts}</p>
                <p className="mt-1 text-sm text-neutral-400">Items por debajo del nivel sugerido.</p>
              </div>
              <Archive className="h-5 w-5 text-amber-300" />
            </div>
          </div>
        </div>
      </section>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('products.upgrade.title')}
        message={t('products.upgrade.message')}
        limitName={t('products.limit_products') || 'Products'}
      />

      {isImportOpen && canEditProducts && (
        <Card className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker mb-2">Importacion masiva</p>
              <h2 className="section-title text-2xl">Importar productos</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                Soporta CSV y JSON. Limite inicial: 1000 filas por importacion. El `companyId` se toma de tu sesion actual.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="h-12 gap-2 px-6"
                onClick={() => downloadCsvTemplate('productos-template.csv', ['name', 'sku', 'price', 'cost', 'stockLevel', 'category', 'status', 'description'])}
              >
                <Download className="h-4 w-4" /> Descargar plantilla
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-blue-400/30 bg-[linear-gradient(180deg,rgba(91,136,255,0.95),rgba(50,95,219,0.95))] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(61,103,255,0.32)]">
                Seleccionar archivo
                <input type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={handleProductImportFile} />
              </label>
            </div>
          </div>

          {importError && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{importError}</p>
          )}

          {importResult && (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Importacion completada. Procesadas: {importResult.total_processed}. Creados: {importResult.created}. Invalidos: {importResult.invalid}. Duplicados en archivo: {importResult.duplicates_in_file}. Duplicados existentes: {importResult.duplicates_existing}.
            </p>
          )}

          {importPreview && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="data-tile"><p className="section-kicker mb-2 !text-neutral-500">Archivo</p><p className="text-sm font-semibold text-white">{importPreview.fileName}</p></div>
                <div className="data-tile"><p className="section-kicker mb-2 !text-neutral-500">Filas</p><p className="text-3xl font-bold text-white">{importPreview.totalRows}</p></div>
                <div className="data-tile"><p className="section-kicker mb-2 !text-neutral-500">Validas</p><p className="text-3xl font-bold text-emerald-300">{importPreview.validRows}</p></div>
                <div className="data-tile"><p className="section-kicker mb-2 !text-neutral-500">Invalidas</p><p className="text-3xl font-bold text-red-300">{importPreview.invalidRows}</p></div>
                <div className="data-tile"><p className="section-kicker mb-2 !text-neutral-500">Dup. archivo</p><p className="text-3xl font-bold text-amber-300">{importPreview.duplicateInFileRows}</p></div>
                <div className="data-tile"><p className="section-kicker mb-2 !text-neutral-500">Dup. existentes</p><p className="text-3xl font-bold text-orange-300">{importPreview.duplicateExistingRows}</p></div>
              </div>

              <div className="space-y-3">
                {importPreview.rows.filter((row) => row.issues.length > 0 || row.duplicateKeys.length > 0).slice(0, 20).map((row) => (
                  <div key={`${row.index}-${row.raw.sku || row.raw.name}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white">Fila {row.index}</p>
                    <p className="mt-2 text-sm text-neutral-300">{row.raw.name || 'Sin nombre'} / {row.raw.sku || 'Sin SKU'}</p>
                    <p className="mt-2 text-xs leading-relaxed text-amber-200">{[...row.issues, ...row.duplicateKeys].join(' | ')}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => { setImportPreview(null); setImportError(null); setImportResult(null); }}>
                  Limpiar preview
                </Button>
                <Button type="button" disabled={importing || importPreview.validRows === 0} onClick={handleConfirmProductImport}>
                  {importing ? 'Importando...' : 'Confirmar importacion'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker mb-2">Filtros</p>
              <h2 className="section-title text-2xl">{t('products.table.identity')}</h2>
              <p className="mt-2 text-sm text-neutral-400">Busca productos y revisa precio, stock y disponibilidad comercial.</p>
            </div>
            <div className="relative group w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 transition-colors group-focus-within:text-blue-500" />
              <Input
                placeholder={t('common.search')}
                className="h-12 border-white/10 bg-black/30 pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {productsError && (
          <div className="mx-6 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
            <span>{productsError}</span>
            <button
              type="button"
              onClick={() => fetchProducts()}
              className="rounded-xl border border-red-400/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-red-100 transition-colors hover:bg-red-500/15"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[rgba(6,10,16,0.92)] backdrop-blur-xl">
                <th className="table-header">{t('products.table.identity')}</th>
                <th className="table-header">{t('products.table.metadata')}</th>
                <th className="table-header">{t('products.table.price')}</th>
                <th className="table-header">{t('products.table.stock')}</th>
                <th className="table-header text-right">{t('products.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product, i) => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-500 transition-colors group-hover:border-blue-500/40">
                        {product.imageURL ? (
                          <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Box className="w-5 h-5 text-neutral-600 transition-colors group-hover:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-neutral-100">{product.name}</p>
                        <span className={cn('mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em]', getStatusClasses(product.status))}>
                          {getStatusLabel(product.status)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-400">{product.category || t('products.table.generic')}</span>
                      <span className="font-mono text-[10px] uppercase tracking-tighter text-neutral-600">{product.sku || t('products.table.no_sku')}</span>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-sm text-white">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full border border-white/[0.05] bg-white/[0.03]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((product.stockLevel / 50) * 100, 100)}%` }}
                          className={`h-full rounded-full ${product.stockLevel > 10 ? 'bg-emerald-500/50' : 'bg-amber-500/50'}`}
                        />
                      </div>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-mono text-neutral-300">{product.stockLevel}</span>
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    {canEditProducts && (
                      <div className="flex translate-x-2 justify-end gap-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                        <Button variant="ghost" className="h-9 w-9 rounded-xl p-0" onClick={() => handleEdit(product)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" className="h-9 w-9 rounded-xl p-0 text-red-400 hover:bg-red-400/5 hover:text-red-300" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-white/[0.05] sm:hidden">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="space-y-3 p-4 active:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.03] shrink-0">
                    {product.imageURL ? (
                      <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Box className="w-5 h-5 text-neutral-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-neutral-200">{product.name}</p>
                    <p className="truncate font-mono text-[10px] text-neutral-600">{product.sku || 'Sin SKU'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm text-white">{formatCurrency(product.price)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">{product.stockLevel} {t('products.table.in_node')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', getStatusClasses(product.status))}>
                  {getStatusLabel(product.status)}
                </span>
                {canEditProducts && (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="h-8 w-8 rounded-xl p-0" onClick={() => handleEdit(product)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-16 sm:px-6">
            <EmptyStatePanel
              eyebrow={hasActiveFilters ? 'Sin resultados' : 'Catalogo'}
              title={hasActiveFilters ? 'No hay productos para esta busqueda.' : 'Tu catalogo empieza aqui.'}
              description={hasActiveFilters ? 'Prueba otro termino o limpia la busqueda para ver mas productos.' : 'Anade productos para activar inventario, ventas y analisis de IA.'}
              icon={<Box className="h-7 w-7" />}
              primaryActionLabel={canEditProducts ? 'Anadir producto' : undefined}
              onPrimaryAction={canEditProducts ? handleCreateNew : undefined}
              secondaryActionLabel={hasActiveFilters ? 'Limpiar busqueda' : 'Importar CSV'}
              onSecondaryAction={() => {
                if (hasActiveFilters) {
                  setSearch('');
                  return;
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black"
            >
              <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] p-8">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">
                  {selectedProduct ? t('products.modal.title') : t('products.modal.init_title')}
                </h2>
                <button type="button" aria-label="Cerrar" onClick={handleCloseModal} className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6 p-8">
                <div className="mb-4 flex items-start gap-8">
                  <div className="w-32 shrink-0">
                    <ImageUpload
                      value={form.imageURL}
                      onChange={(url) => setForm({ ...form, imageURL: url })}
                      path={`companies/${company?.id}/products`}
                      label={t('products.modal.avatar')}
                    />
                  </div>
                  <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="col-span-2">
                      <Label>{t('products.name')}</Label>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('products.modal.name_placeholder')} />
                    </div>
                    <div>
                      <Label>{t('products.category')}</Label>
                      <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Hardware" />
                    </div>
                    <div>
                      <Label>{t('products.sku')}</Label>
                      <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. SK-1002-X" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label>{t('products.price')}</Label>
                    <Input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>{t('products.stock')}</Label>
                    <Input required type="number" value={form.stockLevel} onChange={(e) => setForm({ ...form, stockLevel: e.target.value })} placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <Label>{t('products.status')}</Label>
                    <select
                      aria-label={t('products.status')}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    >
                      <option value="active" className="bg-neutral-900">{t('common.active')}</option>
                      <option value="draft" className="bg-neutral-900">{t('common.draft')}</option>
                      <option value="archived" className="bg-neutral-900">{t('common.archived')}</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Label>{t('products.modal.desc_label')}</Label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder={t('products.modal.desc_placeholder')}
                    />
                  </div>
                </div>
                {formError && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{formError}</p>
                )}
                <div className="flex justify-end gap-3 border-t border-white/5 pt-6">
                  <Button type="button" variant="secondary" onClick={handleCloseModal} className="px-6">{t('common.abort')}</Button>
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
