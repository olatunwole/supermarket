import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  X,
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  Upload,
  Download,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { Barcode } from '../components/Barcode';
import * as XLSX from 'xlsx';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: number | null;
  category_name?: string;
  unit_price: string | number;
  cost_price: string | number;
  quantity_on_hand: number;
  reorder_threshold: number;
  supplier_id: number | null;
  supplier_name?: string;
  expiry_date: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

export const Inventory: React.FC = () => {
  const { apiFetch, showNotification, user, formatCurrency, currency, storeSettings } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeModalProduct, setBarcodeModalProduct] = useState<Product | null>(null);
  const [labelType, setLabelType] = useState<'barcode' | 'qrcode'>('barcode');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick stock adjustment state
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjProduct, setAdjProduct] = useState<Product | null>(null);
  const [adjQty, setAdjQty] = useState('');
  const [adjType, setAdjType] = useState('audit'); // 'audit', 'damage', 'loss'
  const [adjReason, setAdjReason] = useState('');

  // Filters & Search
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_id: '',
    unit_price: '',
    cost_price: '',
    quantity_on_hand: '0',
    reorder_threshold: '10',
    supplier_id: '',
    expiry_date: ''
  });

  const generateRandomBarcode = () => {
    const prefix = '200';
    let newBarcode = '';
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 100) {
      const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
      const tempBarcode = prefix + randomPart;
      
      const exists = products.some(p => p.barcode === tempBarcode);
      if (!exists) {
        newBarcode = tempBarcode;
        isUnique = true;
      }
      attempts++;
    }
    
    if (newBarcode) {
      setFormData(prev => ({ ...prev, barcode: newBarcode }));
      showNotification('Unique barcode generated successfully', 'success');
    } else {
      showNotification('Failed to generate a unique barcode. Try again.', 'error');
    }
  };

  const generateRandomSku = () => {
    if (formData.barcode) {
      setFormData(prev => ({ ...prev, sku: prev.barcode }));
      showNotification('SKU matched to active barcode', 'success');
      return;
    }

    const prefix = '200';
    let newSku = '';
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 100) {
      const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
      const tempSku = prefix + randomPart;
      
      const exists = products.some(p => p.sku === tempSku || p.barcode === tempSku);
      if (!exists) {
        newSku = tempSku;
        isUnique = true;
      }
      attempts++;
    }
    
    if (newSku) {
      setFormData(prev => ({ ...prev, sku: newSku, barcode: formData.barcode || newSku }));
      showNotification('Unique SKU generated and linked to barcode', 'success');
    } else {
      showNotification('Failed to generate a unique SKU. Try again.', 'error');
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prods, cats, sups] = await Promise.all([
        apiFetch<Product[]>('/api/products'),
        apiFetch<Category[]>('/api/categories'),
        apiFetch<Supplier[]>('/api/suppliers')
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Quick Stock Adjustment Handler
  const handleOpenAdjModal = (prod: Product) => {
    setAdjProduct(prod);
    setAdjQty('');
    setAdjType('audit');
    setAdjReason('');
    setIsAdjModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProduct || !adjQty) return;

    const qty = parseInt(adjQty);
    if (isNaN(qty) || qty === 0) {
      showNotification('Please enter a valid non-zero quantity', 'warning');
      return;
    }

    try {
      await apiFetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjProduct.id,
          quantity_changed: qty,
          adjustment_type: adjType,
          reason: adjReason || `Quick ${adjType} adjustment`
        })
      });

      showNotification('Stock adjusted successfully!', 'success');
      setIsAdjModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to adjust stock', 'error');
    }
  };

  // CRUD actions
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `PRD-${String(Date.now()).slice(-6)}`,
      barcode: '',
      category_id: categories[0]?.id.toString() || '',
      unit_price: '',
      cost_price: '',
      quantity_on_hand: '0',
      reorder_threshold: '10',
      supplier_id: suppliers[0]?.id.toString() || '',
      expiry_date: ''
    });
    setIsModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      sku: prod.sku,
      barcode: prod.barcode || '',
      category_id: prod.category_id?.toString() || '',
      unit_price: prod.unit_price.toString(),
      cost_price: prod.cost_price.toString(),
      quantity_on_hand: prod.quantity_on_hand.toString(),
      reorder_threshold: prod.reorder_threshold.toString(),
      supplier_id: prod.supplier_id?.toString() || '',
      expiry_date: prod.expiry_date ? prod.expiry_date.split('T')[0] : ''
    });
    setIsModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      showNotification('Product deleted successfully', 'success');
      fetchInitialData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete product', 'error');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.unit_price || !formData.cost_price || formData.reorder_threshold === '') {
      showNotification('Please fill in Name, Cost Price, Retail Price, and Reorder Level', 'warning');
      return;
    }

    let finalBarcode = formData.barcode;
    let finalSku = formData.sku;

    if (!editingProduct) {
      // 1. Generate barcode if missing
      if (!finalBarcode) {
        const prefix = '200';
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 100) {
          const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
          const tempBarcode = prefix + randomPart;
          const exists = products.some(p => p.barcode === tempBarcode || p.sku === tempBarcode);
          if (!exists) {
            finalBarcode = tempBarcode;
            isUnique = true;
          }
          attempts++;
        }
      }

      // 2. Generate SKU if missing
      if (!finalSku) {
        finalSku = finalBarcode;
      }
    }

    const payload = {
      ...formData,
      sku: finalSku,
      barcode: finalBarcode || null,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
      unit_price: parseFloat(formData.unit_price),
      cost_price: parseFloat(formData.cost_price),
      quantity_on_hand: parseInt(formData.quantity_on_hand),
      reorder_threshold: parseInt(formData.reorder_threshold),
      expiry_date: formData.expiry_date || null
    };

    try {
      if (editingProduct) {
        await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showNotification('Product updated successfully', 'success');
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showNotification('Product created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to save product', 'error');
    }
  };

  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      showNotification('No products to export', 'warning');
      return;
    }
    const headers = ['Product Name', 'SKU', 'Barcode', 'Category', 'Supplier', 'Cost Price (£)', 'Retail Price (£)', 'Stock Qty', 'Reorder Level', 'Expiry Date'];
    const rows = filteredProducts.map(prod => [
      `"${prod.name.replace(/"/g, '""')}"`,
      prod.sku,
      prod.barcode || '',
      prod.category_name || 'N/A',
      prod.supplier_name || 'N/A',
      prod.cost_price,
      prod.unit_price,
      prod.quantity_on_hand,
      prod.reorder_threshold,
      prod.expiry_date ? prod.expiry_date.split('T')[0] : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Inventory CSV exported successfully!', 'success');
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Supplier',
      'Cost Price (£)',
      'Retail Price (£)',
      'Stock Qty',
      'Reorder Level',
      'Expiry Date'
    ];
    const sampleData = [
      [
        'Fresh Organic Strawberries 400g',
        '', // SKU left blank so they can test auto-generation!
        '5000112637990',
        'Fruits & Vegetables',
        'Fresh Farms Ltd',
        '1.50',
        '2.99',
        '40',
        '10',
        '2026-08-10'
      ],
      [
        'Whole Milk 2L',
        'PRD-002',
        '5000112637923',
        'Dairy & Eggs',
        'Metro Wholesale',
        '0.85',
        '1.55',
        '100',
        '20',
        '2026-08-15'
      ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'supermarket_inventory_template.xlsx');
    showNotification('Template downloaded successfully!', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rows.length === 0) {
          showNotification('The uploaded file is empty.', 'error');
          return;
        }

        const headers = rows[0].map((h: any) => String(h || '').trim());
        const dataRows = rows.slice(1);

        const findHeaderIdx = (patterns: string[], excludePatterns: string[] = []) => {
          return headers.findIndex(h => {
            const hLower = h.toLowerCase();
            const matchesPattern = patterns.some(p => hLower.includes(p.toLowerCase()));
            const matchesExclude = excludePatterns.some(p => hLower.includes(p.toLowerCase()));
            return matchesPattern && !matchesExclude;
          });
        };

        const idxName = findHeaderIdx(['product name', 'name']);
        const idxSku = findHeaderIdx(['sku']);
        const idxBarcode = findHeaderIdx(['barcode', 'upc', 'ean']);
        const idxCategory = findHeaderIdx(['category', 'cat']);
        const idxUnitPrice = findHeaderIdx(['retail price', 'retail', 'unit price', 'unitprice', 'price'], ['cost price', 'costprice']);
        const idxCostPrice = findHeaderIdx(['cost price', 'costprice', 'cost']);
        const idxQty = findHeaderIdx(['stock qty', 'stock', 'quantity', 'qty']);
        const idxReorder = findHeaderIdx(['reorder level', 'reorder', 'threshold', 'limit']);
        const idxSupplier = findHeaderIdx(['supplier', 'vendor']);
        const idxExpiry = findHeaderIdx(['expiry date', 'expiry', 'expire', 'exp']);

        if (idxName === -1 || idxUnitPrice === -1 || idxCostPrice === -1 || idxReorder === -1) {
          showNotification('Required columns missing. Template must contain Product Name, Cost Price, Retail Price, and Reorder Level.', 'error');
          return;
        }

        const parseNumeric = (val: any): number => {
          if (val == null) return NaN;
          if (typeof val === 'number') return val;
          const cleaned = String(val).replace(/[^\d.-]/g, '');
          return parseFloat(cleaned);
        };

        const parseDateString = (val: any): string | null => {
          if (!val) return null;
          if (val instanceof Date) {
            return val.toISOString().split('T')[0];
          }
          if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
          }
          const match = String(val).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (match) {
            const y = match[1];
            const m = match[2].padStart(2, '0');
            const d = match[3].padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
          return null;
        };

        const parsedRows = dataRows.map((row, index) => {
          const name = row[idxName] ? String(row[idxName]).trim() : '';
          const sku = idxSku !== -1 && row[idxSku] ? String(row[idxSku]).trim() : '';
          const barcode = idxBarcode !== -1 && row[idxBarcode] ? String(row[idxBarcode]).trim() : '';
          const category = idxCategory !== -1 && row[idxCategory] ? String(row[idxCategory]).trim() : '';
          const unitPriceVal = idxUnitPrice !== -1 ? parseNumeric(row[idxUnitPrice]) : NaN;
          const costPriceVal = idxCostPrice !== -1 ? parseNumeric(row[idxCostPrice]) : NaN;
          const quantityVal = idxQty !== -1 && row[idxQty] != null ? parseNumeric(row[idxQty]) : 0;
          const reorderVal = idxReorder !== -1 && row[idxReorder] != null ? parseNumeric(row[idxReorder]) : 10;
          const supplier = idxSupplier !== -1 && row[idxSupplier] ? String(row[idxSupplier]).trim() : '';
          const expiryDate = idxExpiry !== -1 && row[idxExpiry] ? parseDateString(row[idxExpiry]) : null;

          const errors: string[] = [];
          if (!name) errors.push('Product Name is required');
          if (isNaN(unitPriceVal) || unitPriceVal < 0) errors.push('Retail Price must be a valid positive number');
          if (isNaN(costPriceVal) || costPriceVal < 0) errors.push('Cost Price must be a valid positive number');
          if (row[idxReorder] == null || String(row[idxReorder]).trim() === '' || isNaN(reorderVal) || reorderVal < 0) {
            errors.push('Reorder Level is required and must be a valid non-negative number');
          }

          return {
            rowNum: index + 2,
            data: {
              name,
              sku: sku || null,
              barcode: barcode || null,
              category: category || null,
              unit_price: unitPriceVal,
              cost_price: costPriceVal,
              quantity_on_hand: isNaN(quantityVal) ? 0 : Math.round(quantityVal),
              reorder_threshold: isNaN(reorderVal) ? 10 : Math.round(reorderVal),
              supplier: supplier || null,
              expiry_date: expiryDate || null
            },
            isValid: errors.length === 0,
            errors
          };
        }).filter(r => r.data.name);

        setImportRows(parsedRows);
        setIsImportModalOpen(true);
        showNotification('Spreadsheet parsed successfully! Previewing rows.', 'success');
      } catch (err) {
        console.error(err);
        showNotification('Failed to read Excel file. Make sure it is in valid XLSX format.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmitImport = async () => {
    const validData = importRows.filter(r => r.isValid).map(r => r.data);
    if (validData.length === 0) {
      showNotification('No valid rows to import.', 'warning');
      return;
    }

    setImportProgress(true);
    try {
      const res = await apiFetch<{ success: boolean; count: number }>('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData)
      });
      if (res && res.success) {
        showNotification(`Successfully imported/updated ${res.count} products!`, 'success');
        setIsImportModalOpen(false);
        setImportRows([]);
        setUploadedFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setLoading(true);
        const updated = await apiFetch<Product[]>('/api/products');
        setProducts(updated);
        setLoading(false);
      }
    } catch (err: any) {
      showNotification(err.message || 'Import failed', 'error');
    } finally {
      setImportProgress(false);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = products
    .filter(prod => {
      const matchSearch = prod.name.toLowerCase().includes(search.toLowerCase()) || 
                          prod.sku.toLowerCase().includes(search.toLowerCase()) || 
                          (prod.barcode && prod.barcode.includes(search));
      const matchCategory = selectedCategory === '' || prod.category_id === parseInt(selectedCategory);
      const matchSupplier = selectedSupplier === '' || prod.supplier_id === parseInt(selectedSupplier);
      return matchSearch && matchCategory && matchSupplier;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock-asc') return a.quantity_on_hand - b.quantity_on_hand;
      if (sortBy === 'stock-desc') return b.quantity_on_hand - a.quantity_on_hand;
      if (sortBy === 'price-desc') return parseFloat(b.unit_price as string) - parseFloat(a.unit_price as string);
      return 0;
    });

  return (
    <div className="inventory-page" style={{ padding: '8px 0 24px' }}>
      
      {/* Top action header */}
      <div className="flex-space" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={28} className="text-accent" /> Store Stock Inventory
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage product catalog, organize reorders, and audit adjustments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".xlsx" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} /> Bulk Import
          </button>

          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={18} /> Export Catalog
          </button>
          
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={18} /> Add New Product
          </button>
        </div>
      </div>

      {/* QUICK STOCK ADJUSTMENT INLINE FORM CARD */}
      {isAdjModalOpen && adjProduct && (
        <div className="glass-card inline-form-card" style={{ padding: '24px', marginBottom: '24px', position: 'relative', background: 'rgba(19, 26, 46, 0.45)' }}>
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <SlidersHorizontal size={20} className="text-cyan" /> 
              Quick Stock Adjustment: {adjProduct.name}
            </h3>
            <button type="button" className="btn-close" onClick={() => setIsAdjModalOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleQuickAdjustmentSubmit}>
            <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Current Stock</label>
                <input 
                  type="text" 
                  className="form-input" 
                  disabled 
                  value={`${adjProduct.quantity_on_hand} units`} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Adjustment Type *</label>
                <select 
                  className="form-select"
                  required
                  value={adjType}
                  onChange={e => setAdjType(e.target.value as any)}
                >
                  <option value="audit">Physical Inventory Audit</option>
                  <option value="damage">Spillage / Damage</option>
                  <option value="loss">Theft / Discrepancy Loss</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quantity Changed *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  required 
                  placeholder="e.g. 10 or -5"
                  value={adjQty}
                  onChange={e => setAdjQty(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Positive to add stock, negative to subtract.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason / Notes</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Broken packaging"
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAdjModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Adjust Stock</button>
            </div>
          </form>
        </div>
      )}

      {/* ADD / EDIT PRODUCT INLINE FORM CARD */}
      {isModalOpen && (
        <div className="glass-card inline-form-card" style={{ padding: '24px', marginBottom: '24px', position: 'relative', background: 'rgba(19, 26, 46, 0.45)' }}>
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <Plus size={20} className="text-cyan" /> 
              {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add Catalog Product'}
            </h3>
            <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group span-cols" style={{ marginBottom: 0 }}>
                <label className="form-label">Product Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">SKU Code</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.sku} 
                    onChange={e => setFormData({ ...formData, sku: e.target.value })} 
                    placeholder="Auto-generated if empty"
                    style={{ flexGrow: 1 }}
                  />
                  <button 
                    type="button" 
                    onClick={generateRandomSku}
                    style={{ 
                      padding: '0 12px', 
                      fontSize: '0.8rem', 
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      height: '40px'
                    }}
                  >
                    <BarcodeIcon size={14} />
                    Generate
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">UPC Barcode</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.barcode} 
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })} 
                    placeholder="Auto-generated if empty"
                    style={{ flexGrow: 1 }}
                  />
                  <button 
                    type="button" 
                    onClick={generateRandomBarcode}
                    style={{ 
                      padding: '0 12px', 
                      fontSize: '0.8rem', 
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      height: '40px'
                    }}
                  >
                    <BarcodeIcon size={14} />
                    Generate
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Category *</label>
                <select 
                  className="form-select" 
                  value={formData.category_id} 
                  onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Supplier *</label>
                <select 
                  className="form-select" 
                  value={formData.supplier_id} 
                  onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Cost Price (£) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={formData.cost_price} 
                  onChange={e => setFormData({ ...formData, cost_price: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Retail / Unit Price (£) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={formData.unit_price} 
                  onChange={e => setFormData({ ...formData, unit_price: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quantity on Hand *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={formData.quantity_on_hand} 
                  onChange={e => setFormData({ ...formData, quantity_on_hand: e.target.value })} 
                  disabled={!!editingProduct}
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reorder Level Threshold *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={formData.reorder_threshold} 
                  onChange={e => setFormData({ ...formData, reorder_threshold: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group span-cols" style={{ marginBottom: 0 }}>
                <label className="form-label">Batch Expiry Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={formData.expiry_date} 
                  onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} 
                />
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Filters toolbar */}
      <div className="glass-card flex-space" style={{ padding: '16px', borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingLeft: '36px', margin: 0, height: '40px' }} 
              placeholder="Search by SKU, barcode, name..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select 
            className="form-select" 
            style={{ width: '160px', margin: 0, height: '40px' }}
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select 
            className="form-select" 
            style={{ width: '160px', margin: 0, height: '40px' }}
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort By:</span>
          <select 
            className="form-select" 
            style={{ width: '150px', margin: 0, height: '40px' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="name">Product Name</option>
            <option value="stock-asc">Stock (Low to High)</option>
            <option value="stock-desc">Stock (High to Low)</option>
            <option value="price-desc">Price (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Main Inventory list table */}
      {loading ? (
        <div className="flex-center" style={{ minHeight: '30vh' }}><div className="spinner"></div></div>
      ) : (
        <div className="table-responsive glass-card" style={{ overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '16px' }}>Product Details</th>
                <th style={{ padding: '16px' }}>SKU & Barcode</th>
                <th style={{ padding: '16px' }}>Category</th>
                <th style={{ padding: '16px' }}>Pricing</th>
                <th style={{ padding: '16px' }}>Inventory Level</th>
                <th style={{ padding: '16px' }}>Expiry Date</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => {
                  const isLowStock = prod.quantity_on_hand <= prod.reorder_threshold;
                  const isExpired = prod.expiry_date && new Date(prod.expiry_date) < new Date();
                  return (
                    <tr key={prod.id} className="table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600 }}>{prod.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{prod.id}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div>{prod.sku}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>UPC: {prod.barcode || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '16px' }}>{prod.category_name || 'Unassigned'}</td>
                      <td style={{ padding: '16px' }}>
                        <div>Retail: {formatCurrency(prod.unit_price)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cost: {formatCurrency(prod.cost_price)}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: isLowStock ? 'var(--error-rose)' : 'var(--text-primary)' }}>
                            {prod.quantity_on_hand} units
                          </span>
                          {isLowStock && (
                            <span className="badge badge-danger flex-center" style={{ gap: '4px', fontSize: '0.7rem', padding: '2px 6px' }}>
                              <AlertCircle size={10} /> Low
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reorder Min: {prod.reorder_threshold}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {prod.expiry_date ? (
                          <div style={{ color: isExpired ? 'var(--error-rose)' : 'var(--text-primary)' }}>
                            {new Date(prod.expiry_date).toLocaleDateString()}
                            {isExpired && <span style={{ fontSize: '0.7rem', marginLeft: '6px', fontWeight: 600 }}>(EXPIRED)</span>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                          <button className="btn-icon" title="Quick Adjust Stock" onClick={() => handleOpenAdjModal(prod)}>
                            <SlidersHorizontal size={14} />
                          </button>
                          {prod.barcode && (
                            <button className="btn-icon" title="View & Print Barcode Label" onClick={() => { setBarcodeModalProduct(prod); setLabelType('barcode'); }}>
                              <BarcodeIcon size={14} />
                            </button>
                          )}
                          {user && ['admin', 'manager'].includes(user.role) && (
                            <>
                              <button className="btn-icon" title="Edit Catalog" onClick={() => handleOpenEditModal(prod)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn-icon text-danger" title="Delete Product" onClick={() => handleDeleteProduct(prod.id)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {barcodeModalProduct && (
        <div className="modal-backdrop flex-center" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '400px', padding: '24px' }}>
            <div className="modal-header">
              <h3>{labelType === 'barcode' ? 'Barcode Label' : 'QR Code Label'}</h3>
              <button type="button" className="btn-close" onClick={() => setBarcodeModalProduct(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button 
                type="button" 
                className={`btn ${labelType === 'barcode' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setLabelType('barcode')}
              >
                Barcode
              </button>
              <button 
                type="button" 
                className={`btn ${labelType === 'qrcode' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setLabelType('qrcode')}
              >
                QR Code
              </button>
            </div>
            
            <div id="print-label-container" className="print-label-area" style={{ 
              background: '#ffffff', 
              color: '#000000', 
              padding: '24px', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              margin: '16px 0'
            }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                {storeSettings?.name || 'Antigravity Supermarket'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                {barcodeModalProduct.name}
              </div>
              
              {labelType === 'barcode' ? (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                  <Barcode 
                    value={barcodeModalProduct.barcode || ''} 
                    lineColor="#000000" 
                    background="#ffffff"
                    width={1.8}
                    height={60}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(barcodeModalProduct.barcode || barcodeModalProduct.sku)}`}
                    alt="Product QR Code Label"
                    style={{ width: '120px', height: '120px', display: 'block' }}
                  />
                </div>
              )}
              
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>
                {formatCurrency(barcodeModalProduct.unit_price)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBarcodeModalProduct(null)}>
                Close
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                window.print();
              }}>
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="modal-backdrop flex-center" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '750px', width: '95%', padding: '24px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} className="text-accent" /> Bulk Import Catalog
              </h3>
              <button type="button" className="btn-close" onClick={() => { setIsImportModalOpen(false); setImportRows([]); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minWidth: '220px' }}>
                  <p style={{ fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Selected File
                  </p>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileSpreadsheet size={16} />
                    {uploadedFileName || 'No file selected'}
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => fileInputRef.current?.click()}>
                    Select Different File
                  </button>
                </div>

                <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--glass-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minWidth: '220px' }}>
                  <p style={{ fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                    Excel Schema Template
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Columns match the inventory catalog export.
                  </p>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleDownloadTemplate}>
                    <Download size={14} /> Download Template (.xlsx)
                  </button>
                </div>
              </div>

              {importRows.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Parsed Rows ({importRows.length})</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {importRows.filter(r => r.isValid).length} Valid | {importRows.filter(r => !r.isValid).length} Invalid
                    </span>
                  </h4>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '6px', maxHeight: '250px' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <th style={{ padding: '8px 12px' }}>Row</th>
                          <th style={{ padding: '8px 12px' }}>SKU</th>
                          <th style={{ padding: '8px 12px' }}>Name</th>
                          <th style={{ padding: '8px 12px' }}>Category</th>
                          <th style={{ padding: '8px 12px' }}>Prices ({currency})</th>
                          <th style={{ padding: '8px 12px' }}>Stock</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)', background: r.isValid ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{r.rowNum}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.data.sku || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                            <td style={{ padding: '8px 12px' }}>{r.data.name || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{r.data.category || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                            <td style={{ padding: '8px 12px' }}>
                              Cost: {isNaN(r.data.cost_price) ? '-' : formatCurrency(r.data.cost_price)}<br />
                              Retail: {isNaN(r.data.unit_price) ? '-' : formatCurrency(r.data.unit_price)}
                            </td>
                            <td style={{ padding: '8px 12px' }}>{r.data.quantity_on_hand}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {r.isValid ? (
                                <span style={{ color: 'var(--emerald-green)', fontWeight: 500 }}>Ready</span>
                              ) : (
                                <span style={{ color: 'var(--error-rose)' }} title={r.errors.join(', ')}>
                                  Error: {r.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setIsImportModalOpen(false); setImportRows([]); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                disabled={importProgress}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSubmitImport}
                disabled={importRows.length === 0 || importRows.filter(r => r.isValid).length === 0 || importProgress}
              >
                {importProgress ? 'Importing...' : `Import ${importRows.filter(r => r.isValid).length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default Inventory;
