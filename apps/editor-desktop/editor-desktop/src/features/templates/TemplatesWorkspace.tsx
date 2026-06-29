import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useModal } from '../../context/ModalContext';
import { EDITOR_COMMAND_EVENT, normalizeCommand, type EditorCommand } from '../../commandBus';
import { getEngineUrl } from '@energylink/shared-ui';

interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  vendor: string;
  type: 'library' | 'user';
  imageDataUrl?: string;
}

export function TemplatesWorkspace() {
  const { showConfirm } = useModal();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateDetail, setTemplateDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogMode, setDialogMode] = useState<'none' | 'new_template' | 'move_template' | 'import_template'>('none');
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    category: 'Power Meter',
    vendor: ''
  });
  const [variableDraft, setVariableDraft] = useState<any>(null);
  const [error, setError] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isNewVendor, setIsNewVendor] = useState(false);

  // Move Template Dialog states
  const [moveTemplateForm, setMoveTemplateForm] = useState({
    name: '',
    category: 'Power Meter',
    vendor: ''
  });
  const [isNewMoveCategory, setIsNewMoveCategory] = useState(false);
  const [isNewMoveVendor, setIsNewMoveVendor] = useState(false);

  // Import Template Dialog states
  const [importForm, setImportForm] = useState({
    fileContent: '',
    category: 'Power Meter',
    vendor: '',
    templateName: '',
    imageDataUrl: ''
  });
  const [importPreview, setImportPreview] = useState<any>(null);
  const [isNewImportCategory, setIsNewImportCategory] = useState(false);
  const [isNewImportVendor, setIsNewImportVendor] = useState(false);

  const fileInputRef = useMemo(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xgmb';
    return input;
  }, []);

  const imageInputRef = useMemo(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    return input;
  }, []);

  function templateImageSrc(detail: any) {
    return detail?.imageDataUrl || detail?.deviceImage || detail?.metadata?.imageDataUrl || detail?.metadata?.deviceImage || '';
  }

  function validateTemplateFields(form: { name?: string; category?: string; vendor?: string }) {
    const missing: string[] = [];
    if (!form.category?.trim()) missing.push('Category');
    if (!form.vendor?.trim()) missing.push('Vendor');
    else if (['unknown', 'undefined', 'null', 'other'].includes(form.vendor.trim().toLowerCase())) missing.push('Vendor (use a real brand name)');
    if (!form.name?.trim()) missing.push('Model Name');
    return missing;
  }

  function isUnknownVendorLabel(value?: string | null) {
    const v = String(value || '').trim().toLowerCase();
    return !v || v === 'unknown' || v === 'undefined' || v === 'null' || v === 'other';
  }

  function templateTreeVendor(t: TemplateSummary) {
    const pathVendor = t.id.split(':')[2] || '';
    if (!isUnknownVendorLabel(t.vendor)) return t.vendor;
    if (!isUnknownVendorLabel(pathVendor)) return pathVendor;
    return t.vendor || pathVendor || 'Other';
  }

  function templateTreeCategory(t: TemplateSummary) {
    const pathCategory = t.id.split(':')[1] || '';
    return t.category || pathCategory || 'General';
  }

  function enrichTemplateDetail(data: any, id: string) {
    const [, cat, ven, file] = id.split(':');
    const model = data.model || data.name || file?.replace('.json', '') || '';
    return {
      ...data,
      category: data.category || cat || '',
      vendor: data.vendor || data.metadata?.vendor || data.metadata?.brand || (isUnknownVendorLabel(ven) ? '' : ven) || '',
      model,
      name: data.name || model
    };
  }

  function handleTemplateImage() {
    imageInputRef.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPEG, WebP, or SVG).');
        return;
      }
      if (file.size > 512 * 1024) {
        alert('Image must be 512KB or smaller.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageDataUrl = String(event.target?.result || '');
        setTemplateDetail((prev: any) => ({ ...prev, imageDataUrl }));
      };
      reader.readAsDataURL(file);
      imageInputRef.value = '';
    };
    imageInputRef.click();
  }

  function handleImportImage() {
    imageInputRef.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPEG, WebP, or SVG).');
        return;
      }
      if (file.size > 512 * 1024) {
        alert('Image must be 512KB or smaller.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageDataUrl = String(event.target?.result || '');
        setImportForm(prev => ({ ...prev, imageDataUrl }));
        setImportPreview((prev: any) => (prev ? { ...prev, imageDataUrl } : prev));
      };
      reader.readAsDataURL(file);
      imageInputRef.value = '';
    };
    imageInputRef.click();
  }

  async function refresh() {
    try {
      const res = await fetch(`${getEngineUrl()}/api/templates`);
      const data = await res.json();
      setTemplates(data.templates);
    } catch (err) {
      setError('Failed to fetch templates');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const onCommand = (e: Event) => {
      const { module, item } = (e as CustomEvent<EditorCommand>).detail;
      if (module !== 'templates') return;

      const cmd = normalizeCommand(item);
      if (cmd === 'import xgmb') handleImport();
      else if (cmd === 'refresh') void refresh();
      else if (cmd === 'delete' && selectedId) handleDelete();
      else if (cmd === 'new template') handleNewTemplate();
    };

    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
  }, [selectedId]); // Re-bind listener when selectedId changes to ensure closure has latest value

  useEffect(() => {
    if (!selectedId) {
      setTemplateDetail(null);
      setError('');
      return;
    }

    async function fetchDetail(id: string) {
      setLoading(true);
      setError('');
      try {
        const url = `${getEngineUrl()}/api/templates/detail?id=${encodeURIComponent(id)}`;
        console.log('[Templates] Fetching detail:', url);
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log('[Templates] Received detail data:', data);
        setTemplateDetail(enrichTemplateDetail(data, id));
      } catch (err) {
        console.error('[Templates] Failed to fetch template detail:', err);
        setTemplateDetail(null);
        setError(err instanceof Error ? err.message : 'Could not load template details');
      } finally {
        setLoading(false);
      }
    }

    if (selectedId) {
      void fetchDetail(selectedId);
    }
  }, [selectedId]);

  async function handleImport() {
    fileInputRef.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        try {
          const res = await fetch(`${getEngineUrl()}/api/templates/import-xgmb`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileContent: content, templateName: file.name.replace('.xgmb', '') })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);
          
          const baseName = data.fileName || '';
          const importedCategory = 'Power Meter';
          const importedVendor = baseName.split('-')[0] || '';
          setImportForm({
            fileContent: content,
            category: importedCategory,
            vendor: importedVendor,
            templateName: baseName,
            imageDataUrl: '',
          });
          setIsNewImportCategory(!existingCategories.includes(importedCategory));
          setIsNewImportVendor(!existingVendors.includes(importedVendor));
          setImportPreview(data.config);
          setDialogMode('import_template');
          
          // Clear file input so it can be triggered again for same file
          fileInputRef.value = '';
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Import failed');
        }
      };
      reader.readAsText(file);
    };
    fileInputRef.click();
  }

  async function confirmImportTemplate() {
    const missing = validateTemplateFields({
      name: importForm.templateName,
      category: importForm.category,
      vendor: importForm.vendor
    });
    if (missing.length) {
      alert(`Please fill: ${missing.join(', ')}`);
      return;
    }

    try {
      const res = await fetch(`${getEngineUrl()}/api/templates/import-xgmb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importForm)
      });
      if (!res.ok) throw new Error('Failed to save template');
      
      setDialogMode('none');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  function handleMoveTemplate() {
    if (!templateDetail || !selectedId) return;
    const [type, cat, ven, file] = selectedId.split(':');
    const name = file.replace('.json', '');

    setMoveTemplateForm({
      category: cat || 'Power Meter',
      vendor: ven || '',
      name: name
    });
    setIsNewMoveCategory(!existingCategories.includes(cat));
    setIsNewMoveVendor(!existingVendors.includes(ven));
    setDialogMode('move_template');
  }

  async function confirmMoveTemplate() {
    const missing = validateTemplateFields(moveTemplateForm);
    if (missing.length) {
      alert(`Please fill: ${missing.join(', ')}`);
      return;
    }

    try {
      // 1. Save template to the new path
      const saveRes = await fetch(`${getEngineUrl()}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: moveTemplateForm.category,
          vendor: moveTemplateForm.vendor,
          name: moveTemplateForm.name,
          config: templateDetail
        })
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.message || 'Failed to save to new location');
      }

      // 2. Delete the old template file if path changed
      const [type, oldCat, oldVen, oldFile] = selectedId!.split(':');
      const oldName = oldFile.replace('.json', '');
      
      if (oldCat !== moveTemplateForm.category || oldVen !== moveTemplateForm.vendor || oldName !== moveTemplateForm.name) {
        const deleteRes = await fetch(`${getEngineUrl()}/api/templates?id=${encodeURIComponent(selectedId!)}`, {
          method: 'DELETE'
        });
        if (!deleteRes.ok) {
          console.warn('[Templates] Failed to delete old template file after moving');
        }
      }

      // 3. Select the new template
      const newId = `user:${moveTemplateForm.category}:${moveTemplateForm.vendor}:${moveTemplateForm.name}.json`;

      setDialogMode('none');
      await refresh();
      setSelectedId(newId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    const [type, cat, ven, file] = selectedId.split(':');
    const name = file.replace('.json', '');
    if (!await showConfirm(`Are you sure you want to delete template "${name}"?`)) return;
    
    try {
      const res = await fetch(`${getEngineUrl()}/api/templates?id=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedId(null);
        await refresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Delete failed');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  }

  async function handleNewTemplate() {
    setNewTemplateForm({
      name: '',
      category: existingCategories[0] || 'Power Meter',
      vendor: existingVendors[0] || ''
    });
    setIsNewCategory(existingCategories.length === 0);
    setIsNewVendor(existingVendors.length === 0);
    setDialogMode('new_template');
  }

  async function confirmCreateTemplate() {
    const form = {
      name: newTemplateForm.name.trim(),
      category: newTemplateForm.category.trim(),
      vendor: newTemplateForm.vendor.trim()
    };
    const missing = validateTemplateFields(form);
    if (missing.length) {
      alert(`Please fill: ${missing.join(', ')}`);
      return;
    }

    try {
      const res = await fetch(`${getEngineUrl()}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const newId = `user:${form.category}:${form.vendor}:${form.name}.json`;
        setDialogMode('none');
        await refresh();
        setSelectedId(newId);
      } else {
        const data = await res.json();
        alert(data.message || 'Creation failed');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  }

  async function handleSaveChanges() {
    if (!templateDetail || !selectedId) return;
    const [type, oldCat, oldVen, file] = selectedId.split(':');
    const oldName = file.replace('.json', '');
    const category = String(templateDetail.category || oldCat).trim();
    const vendor = String(templateDetail.vendor || oldVen).trim();
    const name = String(templateDetail.model || templateDetail.name || oldName).trim();
    const missing = validateTemplateFields({ name, category, vendor });
    if (missing.length) {
      alert(`Please fill: ${missing.join(', ')}`);
      return;
    }

    const config = enrichTemplateDetail({
      ...templateDetail,
      category,
      vendor,
      model: name,
      name
    }, selectedId);

    try {
      const res = await fetch(`${getEngineUrl()}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, vendor, name, config })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Save failed');
        return;
      }

      if (oldCat !== category || oldVen !== vendor || oldName !== name) {
        const deleteRes = await fetch(`${getEngineUrl()}/api/templates?id=${encodeURIComponent(selectedId)}`, {
          method: 'DELETE'
        });
        if (!deleteRes.ok) {
          console.warn('[Templates] Saved to new path but failed to delete old template file');
        }
      }

      const newId = `user:${category}:${vendor}:${name}.json`;
      setSelectedId(newId);
      await refresh();
      alert('Changes saved successfully');
    } catch (err) {
      alert('Failed to connect to server');
    }
  }

  function handleAddVariable(type: 'NUMERIC' | 'BINARY') {
    setVariableDraft({
      name: '',
      description: '',
      initAddress: 0,
      type: type,
      dataType: type === 'NUMERIC' ? 'float32' : 'bool',
      units: '',
      registers: type === 'NUMERIC' ? 2 : 1,
      functionCode: 3,
      functionWriteCode: 16
    });
    // setDialogMode('variable'); // No longer using dialog for variables
  }

  function handleEditVariable(variable: any) {
    setVariableDraft({ ...variable });
    // setDialogMode('variable');
  }

  function handleCancelVariable() {
    setVariableDraft(null);
  }

  async function handleDeleteVariable(index: number) {
    if (!await showConfirm('Are you sure you want to delete this variable?')) return;
    const nextVariables = [...templateDetail.variables];
    nextVariables.splice(index, 1);
    setTemplateDetail({ ...templateDetail, variables: nextVariables });
  }

  function confirmSaveVariable() {
    if (!variableDraft.name) {
      alert('Variable name is required');
      return;
    }

    const nextVariables = [...(templateDetail.variables || [])];

    // Let's use index-based editing instead
    if (variableDraft._index !== undefined) {
      const { _index, ...data } = variableDraft;
      nextVariables[_index] = data;
    } else {
      nextVariables.push(variableDraft);
    }

    setTemplateDetail({ ...templateDetail, variables: nextVariables });
    setDialogMode('none');
    setVariableDraft(null);
  }

  function handleExportJson() {
    if (!templateDetail) return;
    const blob = new Blob([JSON.stringify(templateDetail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateDetail.name || 'template'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filter and Group templates
  const filteredTemplates = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(term) || 
      t.vendor.toLowerCase().includes(term) || 
      t.category.toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, Record<string, TemplateSummary[]>> = {};
    filteredTemplates.forEach(t => {
      const category = templateTreeCategory(t);
      const vendor = templateTreeVendor(t);
      if (!groups[category]) groups[category] = {};
      if (!groups[category][vendor]) groups[category][vendor] = [];
      groups[category][vendor].push(t);
    });
    return groups;
  }, [filteredTemplates]);

  const existingCategories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [templates]);

  const existingVendors = useMemo(() => {
    const vends = new Set(templates.map(t => t.vendor).filter(Boolean));
    return Array.from(vends).sort();
  }, [templates]);

  console.log('[Templates] Render state:', { selectedId, hasDetail: !!templateDetail, loading, error });

  return (
    <div className="templates-page" style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Sidebar: Tree View */}
      <aside className="templates-sidebar" style={{ width: '280px', borderRight: '1px solid #c9dbe2', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #c9dbe2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', letterSpacing: '0.05em', color: '#034f5a', fontWeight: '800' }}>TEMPLATE LIBRARY</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
               <button type="button" onClick={handleNewTemplate} className="btn-icon-tiny" title="New Template"><Icon icon="solar:document-add-bold" /></button>
               <button type="button" onClick={handleImport} className="btn-icon-tiny" title="Import XGMB"><Icon icon="solar:cloud-upload-bold" /></button>
               <button type="button" onClick={() => void refresh()} className="btn-icon-tiny" title="Refresh"><Icon icon="solar:refresh-bold" /></button>
            </div>
          </div>
          <div className="search-box-modern">
            <Icon icon="solar:magnifer-linear" />
            <input placeholder="Search templates..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {Object.entries(groupedTemplates).map(([category, vendors]) => (
            <div key={category} className="tree-group">
              <div className="tree-group-header">
                <Icon icon="solar:folder-2-bold-duotone" />
                <span>{category}</span>
              </div>
              <div className="tree-group-content">
                {Object.entries(vendors).map(([vendor, items]) => (
                  <div key={vendor} className="tree-subgroup">
                    <div className="tree-subgroup-header">{vendor}</div>
                    {items.map(t => (
                      <button 
                        type="button"
                        key={t.id} 
                        className={`tree-item ${selectedId === t.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('[Templates] Selecting template:', t.id);
                          setSelectedId(t.id);
                        }}
                      >
                        {t.imageDataUrl ? (
                          <img src={t.imageDataUrl} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }} />
                        ) : (
                          <Icon icon="solar:document-text-bold-duotone" />
                        )}
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content: Template Dashboard */}
      <main className="templates-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f8fafc', position: 'relative' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon="solar:spinner-bold-duotone" width="48" className="spin" style={{ color: '#087c8b' }} />
            <p style={{ color: '#94a3b8', marginTop: '12px' }}>Loading template details...</p>
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff5f5' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#fff', border: '2px solid #feb2b2', display: 'grid', placeItems: 'center', marginBottom: '20px' }}>
              <Icon icon="solar:danger-bold-duotone" width="50" style={{ color: '#f56565' }} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#c53030' }}>Failed to Load Template</h3>
            <p style={{ margin: 0, color: '#e53e3e', maxWidth: '400px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
              {error}
            </p>
            <button 
              type="button"
              onClick={() => {
                if (selectedId) {
                  const sid = selectedId;
                  setSelectedId(null);
                  setTimeout(() => setSelectedId(sid), 50);
                }
              }} 
              className="btn-modern secondary" 
              style={{ marginTop: '24px', borderColor: '#feb2b2' }}
            >
              <Icon icon="solar:refresh-bold" /> Try Again
            </button>
          </div>
        ) : templateDetail ? (
          <div key={selectedId} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Template Header Toolbar */}
            <header style={{ padding: '16px 24px', backgroundColor: '#fff', borderBottom: '1px solid #c9dbe2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {templateImageSrc(templateDetail) ? (
                  <img
                    src={templateImageSrc(templateDetail)}
                    alt={templateDetail.name || 'Template'}
                    style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                  />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#e5f7fa', display: 'grid', placeItems: 'center', color: '#087c8b' }}>
                    <Icon icon="solar:box-bold-duotone" width="24" />
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#034f5a' }}>{templateDetail.name || (selectedId?.split(':').pop()?.replace('.json', ''))}</h2>
                  <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '12px' }}>
                    <span><Icon icon="solar:tag-linear" /> {templateDetail.vendor || '—'}</span>
                    <span><Icon icon="solar:folder-linear" /> {templateDetail.category || '—'}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-modern secondary" onClick={handleMoveTemplate} style={{ color: '#0ea5e9', borderColor: '#bae6fd' }}><Icon icon="solar:folder-transfer-bold-duotone" /> Move / Rename</button>
                <button type="button" className="btn-modern secondary" onClick={handleDelete} style={{ color: '#ef4444', borderColor: '#fecaca' }}><Icon icon="solar:trash-bin-trash-bold-duotone" /> Delete Template</button>
                <button type="button" className="btn-modern secondary" onClick={handleExportJson}><Icon icon="solar:download-square-bold-duotone" /> Export JSON</button>
                <button type="button" className="btn-modern primary" onClick={handleSaveChanges}><Icon icon="solar:diskette-bold-duotone" /> Save Changes</button>
              </div>
            </header>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', maxWidth: '1600px', margin: '0 auto' }}>
                
                {/* Left Panel: Basic Config */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  <div className="card-modern">
                    <div className="card-modern-header">TEMPLATE INFO</div>
                    <div className="card-modern-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="setting-row" style={{ marginBottom: 0 }}>
                        <label>Category</label>
                        <input
                          className="input-modern"
                          value={templateDetail.category || ''}
                          onChange={e => setTemplateDetail({ ...templateDetail, category: e.target.value })}
                          placeholder="e.g. Power Meter"
                        />
                      </div>
                      <div className="setting-row" style={{ marginBottom: 0 }}>
                        <label>Vendor (Brand)</label>
                        <input
                          className="input-modern"
                          value={templateDetail.vendor || ''}
                          onChange={e => setTemplateDetail({ ...templateDetail, vendor: e.target.value })}
                          placeholder="e.g. Socomec, CIRCUTOR"
                        />
                      </div>
                      <div className="setting-row" style={{ marginBottom: 0 }}>
                        <label>Model Name</label>
                        <input
                          className="input-modern"
                          value={templateDetail.model || templateDetail.name || ''}
                          onChange={e => setTemplateDetail({ ...templateDetail, model: e.target.value, name: e.target.value })}
                          placeholder="e.g. A10, CVM-C11"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="card-modern">
                    <div className="card-modern-header">DEVICE IMAGE</div>
                    <div className="card-modern-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {templateImageSrc(templateDetail) ? (
                          <img
                            src={templateImageSrc(templateDetail)}
                            alt="Device"
                            style={{ width: '72px', height: '72px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}
                          />
                        ) : (
                          <div style={{ width: '72px', height: '72px', border: '1px dashed #cbd5e1', borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: '10px', textAlign: 'center', padding: '6px' }}>
                            No image
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <button type="button" className="btn-modern secondary" onClick={handleTemplateImage}>
                            <Icon icon="solar:gallery-upload-bold-duotone" /> Upload image
                          </button>
                          {templateImageSrc(templateDetail) ? (
                            <button
                              type="button"
                              className="btn-modern secondary"
                              onClick={() => setTemplateDetail({ ...templateDetail, imageDataUrl: '' })}
                              style={{ color: '#ef4444', borderColor: '#fecaca' }}
                            >
                              Remove
                            </button>
                          ) : null}
                          <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.4 }}>
                            Used when creating devices from this template. Click Save Changes after uploading.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-modern">
                    <div className="card-modern-header">DEVICE SETTINGS</div>
                    <div className="card-modern-body">
                      <div className="setting-row">
                        <label>Endianness</label>
                        <select 
                          className="select-modern" 
                          value={templateDetail.littleEndianData ? 'little' : 'big'}
                          onChange={e => setTemplateDetail({ ...templateDetail, littleEndianData: e.target.value === 'little' })}
                        >
                          <option value="big">Big Endian (Standard)</option>
                          <option value="little">Little Endian</option>
                        </select>
                      </div>
                      <div className="setting-row">
                        <label>Max Registers</label>
                        <input 
                          type="number" 
                          className="input-modern" 
                          value={templateDetail.maxRegisters || 120} 
                          onChange={e => setTemplateDetail({ ...templateDetail, maxRegisters: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="setting-row" style={{ marginTop: '12px' }}>
                        <label className="checkbox-container-modern">
                          <input 
                            type="checkbox" 
                            checked={!!templateDetail.swapRegisterBytes} 
                            onChange={e => setTemplateDetail({ ...templateDetail, swapRegisterBytes: e.target.checked })}
                          />
                          <span className="checkmark"></span>
                          Swap Register Bytes
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="card-modern">
                    <div className="card-modern-header">STATISTICS</div>
                    <div className="card-modern-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="stat-box">
                        <div className="stat-val">{Array.isArray(templateDetail.variables) ? templateDetail.variables.filter((v:any)=>v.type !== 'BINARY').length : 0}</div>
                        <div className="stat-lbl">Numeric</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-val">{Array.isArray(templateDetail.variables) ? templateDetail.variables.filter((v:any)=>v.type === 'BINARY').length : 0}</div>
                        <div className="stat-lbl">Binary</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Right Panel: Variable Editor & Table */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Inline Variable Editor */}
                  {variableDraft && (
                    <div className="card-modern" style={{ border: '2px solid #087c8b' }}>
                      <div className="card-modern-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e5f7fa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#034f5a' }}>
                          <Icon icon={variableDraft.type === 'BINARY' ? "solar:shield-warning-bold-duotone" : "solar:tag-bold-duotone"} width="18" />
                          <span>{variableDraft._index !== undefined ? 'EDIT VARIABLE' : 'ADD NEW VARIABLE'} ({variableDraft.type})</span>
                        </div>
                        <button type="button" className="btn-icon-tiny" onClick={handleCancelVariable}><Icon icon="solar:close-circle-bold" /></button>
                      </div>
                      <div className="card-modern-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                        <div className="dv-form-group">
                          <label>Name</label>
                          <input className="input-modern" value={variableDraft.name} onChange={e => setVariableDraft({ ...variableDraft, name: e.target.value })} placeholder="e.g. Voltage_L1" />
                        </div>
                        <div className="dv-form-group">
                          <label>Address</label>
                          <input type="number" className="input-modern" value={variableDraft.initAddress} onChange={e => setVariableDraft({ ...variableDraft, initAddress: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="dv-form-group">
                          <label>Data Type</label>
                          <select 
                            className="select-modern"
                            value={variableDraft.dataType} 
                            onChange={e => {
                              const dt = e.target.value;
                              let regs = variableDraft.registers;
                              if (dt === 'float32' || dt === 'int32' || dt === 'uint32') regs = 2;
                              else if (dt === 'int16' || dt === 'uint16') regs = 1;
                              else if (dt === 'bool') regs = 1;
                              setVariableDraft({ ...variableDraft, dataType: dt, registers: regs });
                            }}
                          >
                            {variableDraft.type === 'NUMERIC' ? (
                              <>
                                <option value="float32">Float32 (2 regs)</option>
                                <option value="int32">Int32 (2 regs)</option>
                                <option value="uint32">UInt32 (2 regs)</option>
                                <option value="int16">Int16 (1 reg)</option>
                                <option value="uint16">UInt16 (1 reg)</option>
                              </>
                            ) : (
                              <option value="bool">Boolean / Coil</option>
                            )}
                          </select>
                        </div>
                        <div className="dv-form-group">
                          <label>Unit</label>
                          <input className="input-modern" value={variableDraft.units || variableDraft.unit || ''} onChange={e => setVariableDraft({ ...variableDraft, units: e.target.value, unit: e.target.value })} placeholder="V, A, kWh..." />
                        </div>
                        <div className="dv-form-group">
                          <label>Registers</label>
                          <input type="number" className="input-modern" value={variableDraft.registers} onChange={e => setVariableDraft({ ...variableDraft, registers: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div className="dv-form-group">
                          <label>Read FC</label>
                          <select className="select-modern" value={variableDraft.functionCode || 3} onChange={e => setVariableDraft({ ...variableDraft, functionCode: parseInt(e.target.value) })}>
                            <option value={3}>03 Holding</option>
                            <option value={4}>04 Input</option>
                            <option value={1}>01 Coil</option>
                            <option value={2}>02 Discrete</option>
                          </select>
                        </div>
                        <div className="dv-form-group">
                          <label>Write FC</label>
                          <select className="select-modern" value={variableDraft.functionWriteCode || 16} onChange={e => setVariableDraft({ ...variableDraft, functionWriteCode: parseInt(e.target.value) })}>
                            <option value={16}>16 Multi Regs</option>
                            <option value={6}>06 Single Reg</option>
                            <option value={15}>15 Multi Coils</option>
                            <option value={5}>05 Single Coil</option>
                          </select>
                        </div>
                        <div className="dv-form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                          <button type="button" className="btn-modern primary" style={{ flex: 1 }} onClick={confirmSaveVariable}>
                             <Icon icon="solar:check-circle-bold" /> {variableDraft._index !== undefined ? 'Update' : 'Add Variable'}
                          </button>
                          <button type="button" className="btn-modern secondary" onClick={handleCancelVariable}>Cancel</button>
                        </div>
                        <div className="dv-form-group" style={{ gridColumn: 'span 4' }}>
                          <label>Description</label>
                          <input className="input-modern" value={variableDraft.description || ''} onChange={e => setVariableDraft({ ...variableDraft, description: e.target.value })} placeholder="Variable description..." />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="card-modern">
                    <div className="card-modern-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>VARIABLES LIST</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span className="badge-modern numeric">{Array.isArray(templateDetail.variables) ? templateDetail.variables.filter((v:any)=>v.type !== 'BINARY').length : 0} Numeric</span>
                          <span className="badge-modern binary">{Array.isArray(templateDetail.variables) ? templateDetail.variables.filter((v:any)=>v.type === 'BINARY').length : 0} Binary</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!variableDraft && (
                          <>
                            <button type="button" className="text-btn-modern" onClick={() => handleAddVariable('NUMERIC')}>+ Add Numeric</button>
                            <button type="button" className="text-btn-modern" onClick={() => handleAddVariable('BINARY')} style={{ color: '#f59e0b' }}>+ Add Binary</button>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
                      <table className="table-modern">
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                          <tr>
                            <th>IDENTIFIER</th>
                            <th>ADDRESS</th>
                            <th>DATA TYPE</th>
                            <th>REGS</th>
                            <th>UNIT</th>
                            <th>FC</th>
                            <th>WRITE FC</th>
                            <th style={{ textAlign: 'center' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(templateDetail.variables) && templateDetail.variables.length > 0 ? (
                            templateDetail.variables.map((v: any, i: number) => (
                              <tr key={i} style={{ borderLeft: v.type === 'BINARY' ? '3px solid #f59e0b' : '3px solid #0ea5e9', backgroundColor: variableDraft?._index === i ? '#f0fdfa' : 'transparent' }}>
                                <td>
                                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{v.name}</div>
                                  <div style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{v.description || 'No description'}</div>
                                </td>
                                <td><code className="addr-badge">{v.initAddress}</code></td>
                                <td><span className={`type-pill ${v.type?.toLowerCase()}`}>{v.dataType}</span></td>
                                <td>{v.registers || (v.type === 'BINARY' ? 1 : 2)}</td>
                                <td>{v.units || v.unit || '-'}</td>
                                <td style={{ color: '#64748b', fontSize: '11px' }}>{v.functionCode || 3}</td>
                                <td style={{ color: '#64748b', fontSize: '11px' }}>{v.functionWriteCode || 16}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button type="button" className="icon-action-btn edit" title="Edit" onClick={() => handleEditVariable({ ...v, _index: i })}><Icon icon="solar:pen-bold" /></button>
                                    <button type="button" className="icon-action-btn delete" title="Delete" onClick={() => handleDeleteVariable(i)}><Icon icon="solar:trash-bin-trash-bold" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                              <Icon icon="solar:magnifer-linear" width="48" style={{ opacity: 0.2, marginBottom: '12px' }} />
                              <div>No variables defined in this template</div>
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <Icon icon="solar:document-bold-duotone" width="64" style={{ opacity: 0.2, marginBottom: '16px' }} />
            <h3 style={{ margin: 0 }}>Select a template to view details</h3>
            <p style={{ margin: '8px 0 0 0' }}>Or import a new .xgmb file to get started</p>
          </div>
        )}
      </main>

      {dialogMode === 'new_template' && (
        <div className="dv-dialog-overlay">
          <div className="dv-dialog" style={{ maxWidth: '450px' }}>
            <div className="dv-dialog-header">
              <div className="dv-dialog-title"><Icon icon="solar:document-add-bold-duotone" width="22" /> Create New Template</div>
              <button type="button" className="pm-panel-close" onClick={() => setDialogMode('none')}>x</button>
            </div>
            <div className="dv-dialog-body">
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Category (Topic)</label>
                <select 
                  value={isNewCategory ? '___NEW___' : newTemplateForm.category}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '___NEW___') {
                      setIsNewCategory(true);
                      setNewTemplateForm({...newTemplateForm, category: ''});
                    } else {
                      setIsNewCategory(false);
                      setNewTemplateForm({...newTemplateForm, category: val});
                    }
                  }}
                >
                  {existingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="___NEW___">+ Add New Category...</option>
                </select>
                {isNewCategory && (
                  <input 
                    style={{ marginTop: '8px' }}
                    value={newTemplateForm.category} 
                    onChange={e => setNewTemplateForm({...newTemplateForm, category: e.target.value})} 
                    placeholder="Type new category..." 
                  />
                )}
              </div>
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Vendor (Brand)</label>
                <select 
                  value={isNewVendor ? '___NEW___' : newTemplateForm.vendor}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '___NEW___') {
                      setIsNewVendor(true);
                      setNewTemplateForm({...newTemplateForm, vendor: ''});
                    } else {
                      setIsNewVendor(false);
                      setNewTemplateForm({...newTemplateForm, vendor: val});
                    }
                  }}
                >
                  {existingVendors.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value="___NEW___">+ Add New Vendor...</option>
                </select>
                {isNewVendor && (
                  <input 
                    style={{ marginTop: '8px' }}
                    value={newTemplateForm.vendor} 
                    onChange={e => setNewTemplateForm({...newTemplateForm, vendor: e.target.value})} 
                    placeholder="Type new vendor..." 
                  />
                )}
              </div>
              <div className="dv-form-group">
                <label>Model Name</label>
                <input 
                  value={newTemplateForm.name} 
                  onChange={e => setNewTemplateForm({...newTemplateForm, name: e.target.value})} 
                  placeholder="e.g. PM5100, A40" 
                />
              </div>
            </div>
            <div className="dv-dialog-footer">
              <button type="button" className="btn secondary" onClick={() => setDialogMode('none')}>Cancel</button>
              <div className="spacer" />
              <button type="button" className="btn primary" onClick={confirmCreateTemplate}>Create Template</button>
            </div>
          </div>
        </div>
      )}

      {dialogMode === 'move_template' && (
        <div className="dv-dialog-overlay">
          <div className="dv-dialog" style={{ maxWidth: '450px' }}>
            <div className="dv-dialog-header">
              <div className="dv-dialog-title"><Icon icon="solar:folder-transfer-bold-duotone" width="22" /> Move / Rename Template</div>
              <button type="button" className="pm-panel-close" onClick={() => setDialogMode('none')}>x</button>
            </div>
            <div className="dv-dialog-body">
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Category (Topic)</label>
                <select 
                  value={isNewMoveCategory ? '___NEW___' : moveTemplateForm.category}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '___NEW___') {
                      setIsNewMoveCategory(true);
                      setMoveTemplateForm({...moveTemplateForm, category: ''});
                    } else {
                      setIsNewMoveCategory(false);
                      setMoveTemplateForm({...moveTemplateForm, category: val});
                    }
                  }}
                >
                  {existingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="___NEW___">+ Add New Category...</option>
                </select>
                {isNewMoveCategory && (
                  <input 
                    style={{ marginTop: '8px' }}
                    value={moveTemplateForm.category} 
                    onChange={e => setMoveTemplateForm({...moveTemplateForm, category: e.target.value})} 
                    placeholder="Type new category..." 
                  />
                )}
              </div>
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Vendor (Brand)</label>
                <select 
                  value={isNewMoveVendor ? '___NEW___' : moveTemplateForm.vendor}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '___NEW___') {
                      setIsNewMoveVendor(true);
                      setMoveTemplateForm({...moveTemplateForm, vendor: ''});
                    } else {
                      setIsNewMoveVendor(false);
                      setMoveTemplateForm({...moveTemplateForm, vendor: val});
                    }
                  }}
                >
                  {existingVendors.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value="___NEW___">+ Add New Vendor...</option>
                </select>
                {isNewMoveVendor && (
                  <input 
                    style={{ marginTop: '8px' }}
                    value={moveTemplateForm.vendor} 
                    onChange={e => setMoveTemplateForm({...moveTemplateForm, vendor: e.target.value})} 
                    placeholder="Type new vendor..." 
                  />
                )}
              </div>
              <div className="dv-form-group">
                <label>Model Name</label>
                <input 
                  value={moveTemplateForm.name} 
                  onChange={e => setMoveTemplateForm({...moveTemplateForm, name: e.target.value})} 
                  placeholder="e.g. PM5100, A40" 
                />
              </div>
            </div>
            <div className="dv-dialog-footer">
              <button type="button" className="btn secondary" onClick={() => setDialogMode('none')}>Cancel</button>
              <div className="spacer" />
              <button type="button" className="btn primary" onClick={confirmMoveTemplate}>Confirm Move</button>
            </div>
          </div>
        </div>
      )}

      {dialogMode === 'import_template' && (
        <div className="dv-dialog-overlay">
          <div className="dv-dialog" style={{ maxWidth: '600px' }}>
            <div className="dv-dialog-header">
              <div className="dv-dialog-title"><Icon icon="solar:download-bold-duotone" width="22" /> Import Device Template</div>
              <button type="button" className="pm-panel-close" onClick={() => setDialogMode('none')}>x</button>
            </div>
            <div className="dv-dialog-body">
              <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="dv-form-group">
                  <label>Category (Topic)</label>
                  <select
                    value={isNewImportCategory ? '___NEW___' : importForm.category}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '___NEW___') {
                        setIsNewImportCategory(true);
                        setImportForm({...importForm, category: ''});
                      } else {
                        setIsNewImportCategory(false);
                        setImportForm({...importForm, category: val});
                      }
                    }}
                  >
                    {existingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="___NEW___">+ Add New Category...</option>
                  </select>
                  {isNewImportCategory && (
                    <input 
                      style={{ marginTop: '8px' }}
                      value={importForm.category} 
                      onChange={e => setImportForm({...importForm, category: e.target.value})} 
                      placeholder="Type new category..."
                    />
                  )}
                </div>
                <div className="dv-form-group">
                  <label>Vendor (Brand)</label>
                  <select
                    value={isNewImportVendor ? '___NEW___' : importForm.vendor}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '___NEW___') {
                        setIsNewImportVendor(true);
                        setImportForm({...importForm, vendor: ''});
                      } else {
                        setIsNewImportVendor(false);
                        setImportForm({...importForm, vendor: val});
                      }
                    }}
                  >
                    {existingVendors.map(v => <option key={v} value={v}>{v}</option>)}
                    <option value="___NEW___">+ Add New Vendor...</option>
                  </select>
                  {isNewImportVendor && (
                    <input 
                      style={{ marginTop: '8px' }}
                      value={importForm.vendor} 
                      onChange={e => setImportForm({...importForm, vendor: e.target.value})} 
                      placeholder="Type new vendor..."
                    />
                  )}
                </div>
              </div>
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Template Name (Model)</label>
                <input value={importForm.templateName} onChange={e => setImportForm({...importForm, templateName: e.target.value})} placeholder="e.g. PM5100" />
              </div>

              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Device Image (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {importForm.imageDataUrl ? (
                    <img src={importForm.imageDataUrl} alt="Device preview" style={{ width: '64px', height: '64px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }} />
                  ) : (
                    <div style={{ width: '64px', height: '64px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: '10px' }}>No image</div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn secondary" onClick={handleImportImage}>Upload image</button>
                    {importForm.imageDataUrl ? (
                      <button type="button" className="btn secondary" onClick={() => setImportForm({ ...importForm, imageDataUrl: '' })}>Remove</button>
                    ) : null}
                  </div>
                </div>
              </div>

              {importPreview && (
                <div className="dv-import-preview" style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#64748b' }}>FILE CONTENT PREVIEW</div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc', fontSize: '11px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <b>Modbus Config:</b> {importPreview.littleEndianData ? 'Little Endian' : 'Big Endian'}, 
                      Max Regs: {importPreview.maxRegisters}
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9' }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '4px' }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '4px' }}>Addr</th>
                            <th style={{ textAlign: 'left', padding: '4px' }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.variables && importPreview.variables.map((v: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '4px' }}>{v.name}</td>
                              <td style={{ padding: '4px' }}>{v.initAddress}</td>
                              <td style={{ padding: '4px' }}>{v.dataType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="dv-dialog-footer">
              <button type="button" className="btn secondary" onClick={() => setDialogMode('none')}>Cancel</button>
              <div className="spacer" />
              <button type="button" className="btn primary" onClick={confirmImportTemplate}>Save to Library</button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .tool-mini-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: all 0.2s;
        }
        .tool-mini-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #087c8b;
        }
        .search-box-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          color: #94a3b8;
        }
        .search-input-minimal {
          width: 100%;
          padding: 8px 10px 8px 34px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 12px;
          outline: none;
          transition: all 0.2s;
        }
        .search-input-minimal:focus {
          border-color: #087c8b;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(8,124,139,0.05);
        }
        .tree-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tree-subgroup-header {
          padding: 4px 12px 4px 36px;
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
        }
        .tree-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 8px 44px;
          font-size: 13px;
          color: #334155;
          cursor: pointer;
          border-radius: 8px;
          margin: 1px 4px;
          transition: all 0.15s;
        }
        .tree-item:hover {
          background: #f1f5f9;
        }
        .tree-item.active {
          background: #e5f7fa;
          color: #034f5a;
          font-weight: 600;
        }
        .btn-modern {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .btn-modern.primary {
          background: #087c8b;
          color: #fff;
        }
        .btn-modern.primary:hover {
          background: #034f5a;
        }
        .btn-modern.secondary {
          background: #fff;
          border-color: #c9dbe2;
          color: #034f5a;
        }
        .btn-modern.secondary:hover {
          background: #f8fafc;
          border-color: #087c8b;
        }
        .card-modern {
          background: #fff;
          border: 1px solid #c9dbe2;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
        }
        .card-modern-header {
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #f0f5f7;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.05em;
        }
        .card-modern-body {
          padding: 16px;
        }
        .setting-row {
          margin-bottom: 16px;
        }
        .setting-row label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .input-modern, .select-modern {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          outline: none;
        }
        .input-modern:focus, .select-modern:focus {
          border-color: #087c8b;
        }
        .stat-box {
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
          text-align: center;
          border: 1px solid #f0f5f7;
        }
        .stat-val {
          font-size: 20px;
          font-weight: 800;
          color: #034f5a;
        }
        .stat-lbl {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .table-modern {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .table-modern th {
          text-align: left;
          padding: 10px 16px;
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          border-bottom: 1px solid #f0f5f7;
        }
        .table-modern td {
          padding: 12px 16px;
          border-bottom: 1px solid #f8fafc;
        }
        .addr-badge {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #475569;
          font-weight: 600;
        }
        .type-pill {
          background: #e0f2fe;
          color: #0369a1;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
        }
        .type-pill.binary {
          background: #fef3c7;
          color: #92400e;
        }
        .type-pill.numeric {
          background: #e0f2fe;
          color: #0369a1;
        }
        .badge-modern {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge-modern.numeric { background: #e0f7fa; color: #087c8b; }
        .badge-modern.binary { background: #fff7ed; color: #f59e0b; }
        .text-btn-modern {
          background: none;
          border: none;
          color: #0ea5e9;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .icon-action-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
        .icon-action-btn.edit:hover { background: #f0fdf4; color: #16a34a; }
        .icon-action-btn.delete:hover { background: #fef2f2; color: #dc2626; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

