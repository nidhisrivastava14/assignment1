import React, { useState, useEffect, useMemo } from 'react';
import { DynamicStackProvider, useApiConfig } from '../hooks/useApiConfig';
import FormBuilder from './FormBuilder';
import TableRenderer from './TableRenderer';
import DashboardGrid from './DashboardGrid';
import ErrorBoundary from './ErrorBoundary';

// Helper validator utility to audit schema configs in real-time
function validateSchemaConfig(config: any) {
  const warnings: string[] = [];
  if (!config) {
    return ["Schema configuration is empty or contains invalid JSON structure."];
  }
  if (!config.name) {
    warnings.push("Missing top-level application 'name' property.");
  }
  if (!config.sections || !Array.isArray(config.sections)) {
    warnings.push("Missing root 'sections' configuration array.");
    return warnings;
  }

  config.sections.forEach((section: any, sIndex: number) => {
    if (!section || typeof section !== 'object') {
      warnings.push(`Section index #${sIndex} is defined as an invalid element.`);
      return;
    }
    if (section.name === null || section.name === undefined) {
      warnings.push(`Section index #${sIndex} has a null/missing section name property.`);
    }

    const type = (section.type || 'form').toLowerCase();
    
    if (type === 'form') {
      if (!section.fields || !Array.isArray(section.fields)) {
        warnings.push(`Section "${section.name || sIndex}" is marked as a form but lacks a 'fields' array.`);
      } else {
        section.fields.forEach((field: any, fIndex: number) => {
          if (!field || typeof field !== 'object') {
            warnings.push(`Field index #${fIndex} in Section "${section.name || sIndex}" is not a valid object.`);
            return;
          }
          if (!field.name && !field.label) {
            warnings.push(`Field index #${fIndex} in Section "${section.name || sIndex}" is missing both 'name' and 'label' properties and will be skipped (silent fail).`);
            return;
          }
          if (!field.name) {
            warnings.push(`Field "${field.label}" in Section "${section.name || sIndex}" is missing 'name' property and will be skipped (silent fail).`);
          }
          if (!field.type) {
            warnings.push(`Field "${field.name || field.label}" in Section "${section.name || sIndex}" is missing type. Defaulting to read-only text block.`);
          } else {
            const standardTypes = ['text', 'select', 'date', 'checkbox', 'textarea', 'number'];
            if (!standardTypes.includes(field.type.toLowerCase())) {
              warnings.push(`Field "${field.name}" has unrecognized type "${field.type}". Will degrade to read-only block.`);
            }
          }
        });
      }
    } else if (type === 'dashboard') {
      if (!section.widgets || !Array.isArray(section.widgets)) {
        warnings.push(`Section "${section.name || sIndex}" is marked as a dashboard but lacks a 'widgets' array.`);
      }
    } else if (type === 'table') {
      if (!section.columns || !Array.isArray(section.columns)) {
        warnings.push(`Section "${section.name || sIndex}" is marked as a table but lacks a 'columns' array. Columns will be dynamically mapped from records.`);
      }
    }
  });

  return warnings;
}

interface SystemAlert {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface EditingRecord {
  id: string;
  data: any;
}

function AppContent() {
  // Cast hook context to any to prevent TS context resolution warnings
  const apiContext = useApiConfig() as any;
  const {
    authToken,
    currentUser,
    activeSchema,
    records,
    loading,
    error,
    changeUser,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    setActiveSchema
  } = apiContext;

  const [activeResource, setActiveResource] = useState('users');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [systemAlert, setSystemAlert] = useState<SystemAlert | null>(null);

  // Read URL query parameter for debug mode initialization
  const [debugMode, setDebugMode] = useState<boolean>(() => {
    return window.location.search.includes('debug=true');
  });

  // Fetch records whenever the active resource target changes
  useEffect(() => {
    if (activeResource) {
      setEditingRecord(null);
      setSystemAlert(null);
      fetchRecords(activeResource)
        .catch((err: any) => {
          console.warn("Schema initialization error captured:", err.message);
        });
    }
  }, [activeResource, fetchRecords]);

  // Sync schema changes to Side Panel text area editor
  useEffect(() => {
    if (activeSchema && activeSchema.name === activeResource) {
      setJsonInput(JSON.stringify(activeSchema.config, null, 2));
      setJsonError(null);
    }
  }, [activeSchema, activeResource]);

  // Calculate live schema config warning validation logs
  const schemaValidatorWarnings = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      return validateSchemaConfig(parsed);
    } catch {
      return ["JSON Syntax Error: Invalid JSON configuration structure. Review formatting."];
    }
  }, [jsonInput]);

  // Handle side sidebar editor manual typing changes
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonInput(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  // Commit schema updates back to backend DB
  const handleSaveSchema = async () => {
    if (jsonError) {
      setSystemAlert({ type: 'error', message: "Cannot save schema: please fix JSON syntax errors first." });
      return;
    }
    
    setIsSavingSchema(true);
    setSystemAlert(null);
    try {
      const parsedConfig = JSON.parse(jsonInput);
      
      // Hit update schema endpoint using active schema id
      const response = await fetch(`http://localhost:5000/api/schemas/${activeSchema.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ config: parsedConfig })
      });

      const updated = await response.json();
      if (!response.ok) {
        throw new Error(updated.error || "Failed to update schema configuration");
      }

      // Sync active schema state trigger
      setActiveSchema(updated);
      // Refresh local cache key
      localStorage.setItem(`ds_schema_${activeResource}`, JSON.stringify(updated));
      
      setSystemAlert({ type: 'success', message: `Schema updated successfully! Incremented to version v${updated.version}.` });
      
      // Reload records to sync
      await fetchRecords(activeResource);
    } catch (err: any) {
      setSystemAlert({ type: 'error', message: err.message });
    } finally {
      setIsSavingSchema(false);
    }
  };

  // Reset side editor back to database state
  const handleRevertSchema = () => {
    if (activeSchema) {
      setJsonInput(JSON.stringify(activeSchema.config, null, 2));
      setJsonError(null);
      setSystemAlert(null);
    }
  };

  // Form submit (create or update record mutations)
  const handleFormSubmit = async (formData: any) => {
    setFormSaving(true);
    setSystemAlert(null);
    try {
      if (editingRecord) {
        await updateRecord(activeResource, editingRecord.id, formData);
        setSystemAlert({ type: 'success', message: "Record updated successfully in database." });
        setEditingRecord(null);
      } else {
        await createRecord(activeResource, formData);
        setSystemAlert({ type: 'success', message: "New record created successfully in database." });
      }
    } catch (err: any) {
      setSystemAlert({ type: 'error', message: err.message });
    } finally {
      setFormSaving(false);
    }
  };

  // Click handler to load row into form edit state
  const handleEditClick = (record: any) => {
    // Extract row fields excluding system metadata keys
    const { id, created_at, updated_at, ...cleanData } = record;
    setEditingRecord({ id, data: cleanData });
    setSystemAlert({ type: 'info', message: `Loaded edit mode for record: ${id.substring(0, 8)}...` });
  };

  // Click handler to delete dynamic record
  const handleDeleteClick = async (id: string) => {
    setSystemAlert(null);
    try {
      await deleteRecord(activeResource, id);
      setSystemAlert({ type: 'success', message: "Record successfully deleted from database." });
      if (editingRecord && editingRecord.id === id) {
        setEditingRecord(null);
      }
    } catch (err: any) {
      setSystemAlert({ type: 'error', message: err.message });
    }
  };

  // Pre-load broken config to demonstrate graceful degradation
  const loadBrokenConfigExample = () => {
    const broken = {
      name: "Broken App Test Layout",
      version: 99,
      layout: "form",
      sections: [
        {
          name: "Broken Inputs Section",
          fields: [
            { name: "email" }, // Missing type property (should render as read-only)
            { name: "age", type: "number", required: true }, // Standard validator field
            { type: "text" }, // Missing name parameter (should silent fail)
            { name: "unsupported", type: "weird-structure", label: "Broken Custom Type" } // Unknown type (should fall back to read-only block)
          ]
        },
        {
          name: null // Invalid section name (should handle gracefully)
        }
      ]
    };
    setJsonInput(JSON.stringify(broken, null, 2));
    setJsonError(null);
    setSystemAlert({
      type: 'warning',
      message: "Broken configuration loaded into local editor. Click 'Apply Schema' or 'Apply Local' to test rendering."
    });
  };

  // Force local config apply directly without database writes (local sandbox preview)
  const applyLocalJsonOverride = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setActiveSchema((prev: any) => ({
        ...prev,
        version: (prev?.version || 0) + 1,
        config: parsed
      }));
      setSystemAlert({
        type: 'success',
        message: "Applied editor changes to active preview session."
      });
    } catch (err: any) {
      setJsonError(err.message);
      setSystemAlert({ type: 'error', message: "Cannot apply config override due to JSON syntax errors." });
    }
  };

  // Theme switcher helper (toggles dark class on root documentElement)
  const [themeMode, setThemeMode] = useState(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const root = document.documentElement;
    if (themeMode === 'light') {
      root.classList.add('dark');
      setThemeMode('dark');
    } else {
      root.classList.remove('dark');
      setThemeMode('light');
    }
  };

  // Render components sections defined in active schema configurations
  const renderAppSections = () => {
    if (!activeSchema || !activeSchema.config) {
      return (
        <div className="ds-empty-section-container">
          No schema structure currently loaded. Please create a schema config.
        </div>
      );
    }

    const { sections, layout } = activeSchema.config;

    if (!sections || !Array.isArray(sections)) {
      return (
        <div className="ds-empty-section-container">
          Loaded schema does not define any layout sections.
        </div>
      );
    }

    // Render tree mapping with fallback and error containment boundaries
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sections.map((section: any, sIndex: number) => {
          // Graceful degradation: wrap each section in an error boundary so section failure does not crash app
          const sectionKey = (section && typeof section === 'object' && section.id) || `sec-${sIndex}`;
          
          if (!section || typeof section !== 'object') {
            return (
              <div key={sectionKey} className="ds-empty-section-container" style={{ border: '1px dashed var(--error-color)' }}>
                ⚠️ Skipped section definition index #{sIndex} - Invalid configuration structure.
              </div>
            );
          }

          const resolvedType = (section.type || layout || 'form').toLowerCase();

          return (
            <ErrorBoundary key={sectionKey} sectionName={section.name || `Section #${sIndex}`}>
              {(() => {
                switch (resolvedType) {
                  case 'form':
                    return (
                      <FormBuilder
                        section={section}
                        onSubmit={handleFormSubmit}
                        initialData={editingRecord ? editingRecord.data : null}
                        isSaving={formSaving}
                        loading={loading}
                      />
                    );

                  case 'table':
                    return (
                      <TableRenderer
                        section={section}
                        records={records}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        loading={loading}
                        error={error}
                      />
                    );

                  case 'dashboard':
                    return (
                      <DashboardGrid
                        section={section}
                        loading={loading}
                        error={error}
                      />
                    );

                  default:
                    // Treat unknown section layouts as table if widgets/fields mismatch
                    if (section.fields) {
                      return (
                        <FormBuilder
                          section={section}
                          onSubmit={handleFormSubmit}
                          initialData={editingRecord ? editingRecord.data : null}
                          isSaving={formSaving}
                          loading={loading}
                        />
                      );
                    }
                    return (
                      <div className="ds-empty-section-container">
                        ⚠️ Unknown section layout type "{resolvedType}" found.
                      </div>
                    );
                }
              })()}
            </ErrorBoundary>
          );
        })}
      </div>
    );
  };

  return (
    <div className="ds-app-container">
      {/* ── Top Navigation Bar ── */}
      <header className="ds-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>DS</div>
          <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.03em' }}>
            DynamicStack <span style={{ color: 'var(--primary-color)', fontSize: '12px', fontWeight: 600 }}>v1.0</span>
          </span>
        </div>

        {/* Dynamic selector to switch schema models */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Resource:</span>
            <select
              className="ds-select"
              style={{ padding: '6px 28px 6px 12px', fontSize: '13px', width: '130px', margin: 0 }}
              value={activeResource}
              onChange={(e) => setActiveResource(e.target.value)}
            >
              <option value="users">users (form)</option>
              <option value="dashboard">dashboard (grid)</option>
            </select>
          </div>

          <button
            className="ds-btn ds-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={toggleTheme}
          >
            {themeMode === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>

          <button
            className={`ds-btn ${debugMode ? 'ds-btn-primary' : 'ds-btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => setDebugMode((prev: boolean) => {
              const next = !prev;
              const url = new URL(window.location.href);
              if (next) url.searchParams.set('debug', 'true');
              else url.searchParams.delete('debug');
              window.history.pushState({}, '', url.toString());
              return next;
            })}
          >
            🐞 Debug {debugMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="ds-workspace">
        {/* SIDE BAR: JSON editor */}
        <aside className="ds-editor-sidebar">
          <div className="ds-editor-header">
            <h3 className="ds-editor-title">Schema Configuration Editor</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Edit live application properties
            </span>
          </div>

          <div className="ds-json-editor-area">
            <textarea
              className="ds-textarea-json"
              value={jsonInput}
              onChange={handleJsonChange}
              spellCheck="false"
              placeholder="Paste JSON schema config here..."
            />
            {jsonError && (
              <div style={{ color: 'var(--error-color)', fontSize: '11px', fontFamily: 'monospace' }}>
                ❌ Syntax error: {jsonError}
              </div>
            )}

            {/* Config actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="ds-btn ds-btn-secondary"
                style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                onClick={handleRevertSchema}
              >
                Revert Changes
              </button>
              <button
                className="ds-btn ds-btn-primary"
                style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                onClick={applyLocalJsonOverride}
              >
                Apply Local
              </button>
            </div>
            
            <button
              className="ds-btn ds-btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '13px', background: 'var(--accent-color)' }}
              onClick={handleSaveSchema}
              disabled={isSavingSchema}
            >
              {isSavingSchema ? 'Saving to Database...' : '💾 Save Config & Sync API'}
            </button>

            <button
              className="ds-btn ds-btn-secondary"
              style={{ width: '100%', padding: '6px', fontSize: '11px', borderStyle: 'dashed' }}
              onClick={loadBrokenConfigExample}
            >
              ⚠️ Load Broken Config Example
            </button>
          </div>

          {/* DEBUG PANEL: Shown if debugMode = true */}
          {debugMode && (
            <div style={{ borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              
              {/* 1. Real-time Config warnings validator */}
              <div style={{ padding: '16px' }}>
                <div className="ds-validation-log-card">
                  <h4 className="ds-validation-heading">
                    🔎 Schema Config Audit ({schemaValidatorWarnings.length} alerts)
                  </h4>
                  {schemaValidatorWarnings.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--success-color)' }}>✓ Config fully compliant. No degradation threats detected.</p>
                  ) : (
                    <ul className="ds-validation-ul">
                      {schemaValidatorWarnings.map((warn, i) => (
                        <li key={i} className="ds-validation-li" style={{ fontSize: '11px' }}>
                          ⚠️ {warn}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* 2. Interactive user switcher (scopes / Authorization tests) */}
              <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700 }}>
                  👤 Multi-Tenant Scoping / Switch Role
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    className={`ds-btn`}
                    style={{
                      padding: '6px',
                      fontSize: '11px',
                      textAlign: 'left',
                      backgroundColor: currentUser?.id === 'user_1' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                      color: currentUser?.id === 'user_1' ? 'white' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}
                    onClick={() => changeUser('user_1', 'alice_admin', 'admin')}
                  >
                    👑 Alice (Admin Role) - Full access
                  </button>
                  <button
                    className={`ds-btn`}
                    style={{
                      padding: '6px',
                      fontSize: '11px',
                      textAlign: 'left',
                      backgroundColor: currentUser?.id === 'user_2' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                      color: currentUser?.id === 'user_2' ? 'white' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}
                    onClick={() => changeUser('user_2', 'bob_developer', 'user')}
                  >
                    👨 Bob (User Role) - Scoped to User 2 Data
                  </button>
                  <button
                    className={`ds-btn`}
                    style={{
                      padding: '6px',
                      fontSize: '11px',
                      textAlign: 'left',
                      backgroundColor: currentUser?.id === 'user_3' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                      color: currentUser?.id === 'user_3' ? 'white' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}
                    onClick={() => changeUser('user_3', 'charlie_tester', 'user')}
                  >
                    👩 Charlie (User Role) - Scoped to User 3 Data
                  </button>
                </div>
              </div>

              {/* 3. API state monitoring */}
              <div className="ds-debug-grid">
                <div className="ds-debug-line">
                  <span className="ds-debug-key">Active User:</span>
                  <span className="ds-debug-val">{currentUser?.username} ({currentUser?.role})</span>
                </div>
                <div className="ds-debug-line">
                  <span className="ds-debug-key">Schema Version:</span>
                  <span className="ds-debug-val">v{activeSchema?.version || 'N/A'}</span>
                </div>
                <div className="ds-debug-line">
                  <span className="ds-debug-key">X-Schema Header:</span>
                  <span className="ds-debug-val" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    Active
                  </span>
                </div>
                <div className="ds-debug-line">
                  <span className="ds-debug-key">Token Payload:</span>
                  <span className="ds-debug-val" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {authToken ? 'Bearer ' + authToken.substring(0, 10) + '...' : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* PREVIEW CONTAINER: App preview */}
        <section className="ds-preview-panel">
          {/* Notification System Alerts */}
          {systemAlert && (
            <div style={{
              padding: '12px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: systemAlert.type === 'success' ? 'var(--success-bg)' : systemAlert.type === 'error' ? 'var(--error-bg)' : 'var(--warning-bg)',
              color: systemAlert.type === 'success' ? 'var(--success-color)' : systemAlert.type === 'error' ? 'var(--error-text)' : 'var(--warning-color)',
              border: `1px solid ${systemAlert.type === 'success' ? 'var(--success-border)' : systemAlert.type === 'error' ? 'var(--error-border)' : 'var(--warning-border)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{systemAlert.message}</span>
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => setSystemAlert(null)}
              >
                ✕
              </button>
            </div>
          )}

          {editingRecord && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'var(--primary-light)',
              borderRadius: '8px',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>You are currently editing record <strong>{editingRecord.id}</strong>. Clearing fields will cancel edit.</span>
              <button
                style={{ color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => setEditingRecord(null)}
              >
                Cancel Edit
              </button>
            </div>
          )}

          {/* Dynamic App Header */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' }}>
              {activeSchema?.config?.name || "DynamicStack Preview App"}
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Layout: <strong>{activeSchema?.config?.layout || 'hybrid'}</strong> · Config Version: <strong>v{activeSchema?.version || 1}</strong>
            </p>
          </div>

          {/* Active section rendering */}
          {renderAppSections()}
        </section>
      </main>
    </div>
  );
}

export function App() {
  return (
    <DynamicStackProvider>
      <AppContent />
    </DynamicStackProvider>
  );
}

export default App;
