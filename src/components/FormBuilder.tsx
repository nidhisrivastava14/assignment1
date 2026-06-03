import React, { useState } from 'react';
import useFormConfig from '../hooks/useFormConfig';
import { useApiConfig } from '../hooks/useApiConfig';
import ErrorBoundary from './ErrorBoundary';

export interface FormField {
  name: string;
  label?: string;
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | string;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  options?: string[];
  defaultValue?: any;
}

export interface FormBuilderProps {
  section: {
    name: string;
    fields: FormField[];
  };
  onSubmit: (data: Record<string, any>) => Promise<void>;
  initialData?: Record<string, any> | null;
  loading?: boolean;
  isSaving?: boolean;
}

interface FormFieldWrapperProps {
  field: FormField;
  value: any;
  error: string;
  onChange: (name: string, value: any) => void;
}

function FormFieldWrapper({ field, value, error, onChange }: FormFieldWrapperProps) {
  if (!field || typeof field !== 'object' || !field.name) {
    return null;
  }

  const { name, label, type, placeholder, options } = field;
  const normalizedType = (type || 'text').toLowerCase();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = normalizedType === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.value;
    onChange(name, val);
  };

  return (
    <ErrorBoundary fieldName={name}>
      <div className="ds-form-group">
        {normalizedType !== 'checkbox' && (
          <label className="ds-label" htmlFor={`input-${name}`}>
            {label || name} {field.required && <span className="ds-required-indicator">*</span>}
          </label>
        )}

        {(() => {
          switch (normalizedType) {
            case 'text':
            case 'email':
              return (
                <input
                  id={`input-${name}`}
                  type={normalizedType}
                  className={`ds-input ${error ? 'ds-input-error' : ''}`}
                  placeholder={placeholder || `Enter ${label || name}...`}
                  value={value || ''}
                  onChange={handleInputChange}
                />
              );

            case 'number':
              return (
                <input
                  id={`input-${name}`}
                  type="number"
                  className={`ds-input ${error ? 'ds-input-error' : ''}`}
                  placeholder={placeholder || '0'}
                  value={value !== undefined ? value : ''}
                  onChange={handleInputChange}
                />
              );

            case 'date':
              return (
                <input
                  id={`input-${name}`}
                  type="date"
                  className={`ds-input ${error ? 'ds-input-error' : ''}`}
                  value={value || ''}
                  onChange={handleInputChange}
                />
              );

            case 'textarea':
              return (
                <textarea
                  id={`input-${name}`}
                  className={`ds-textarea ${error ? 'ds-input-error' : ''}`}
                  placeholder={placeholder || `Enter ${label || name}...`}
                  rows={3}
                  value={value || ''}
                  onChange={handleInputChange}
                />
              );

            case 'select':
              return (
                <div className="ds-select-container">
                  <select
                    id={`input-${name}`}
                    className={`ds-select ${error ? 'ds-input-error' : ''}`}
                    value={value || ''}
                    onChange={handleInputChange}
                  >
                    <option value="" disabled hidden>
                      {placeholder || 'Select option...'}
                    </option>
                    {(options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );

            case 'checkbox':
              return (
                <div className="ds-checkbox-wrapper">
                  <input
                    id={`input-${name}`}
                    type="checkbox"
                    className="ds-checkbox-hidden"
                    checked={!!value}
                    onChange={handleInputChange}
                  />
                  <label className="ds-checkbox-label" htmlFor={`input-${name}`}>
                    {label || name} {field.required && <span className="ds-required-indicator">*</span>}
                  </label>
                </div>
              );

            default:
              return (
                <div className="ds-readonly-fallback-wrapper">
                  <input
                    id={`input-${name}`}
                    type="text"
                    className="ds-input ds-input-readonly"
                    value={String(value || '')}
                    readOnly
                    placeholder="[Read-only Unknown Type]"
                  />
                  <span className="ds-readonly-tag">Unknown Type: {type}</span>
                </div>
              );
          }
        })()}

        {error && <span className="ds-error-text">{error}</span>}
      </div>
    </ErrorBoundary>
  );
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ 
  section, 
  onSubmit, 
  initialData = null, 
  isSaving = false, 
  loading = false 
}) => {
  const apiContext = useApiConfig() as any;
  const { authToken, activeSchema, fetchRecords } = apiContext;

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  if (!section || typeof section !== 'object') {
    return (
      <div className="ds-section-fallback ds-section-error">
        [Section Configuration Error] - Invalid or missing section structure.
      </div>
    );
  }

  const sectionName = section.name || "Form Section";
  const fields = section.fields || [];
  
  const validFields = fields.filter(
    f => f && typeof f === 'object' && f.name
  );

  const { values, errors, handleChange, validate, reset } = useFormConfig(validFields, initialData as any) as any;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(values).catch((err: any) => {
        // Map backend validation arrays inline if returned
        if (err.message && err.message.includes("Validation failed")) {
          console.warn("Handling validation warnings inline.");
        }
      });
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile || !activeSchema) return;
    
    setCsvImporting(true);
    const formData = new FormData();
    formData.append('file', csvFile);
    
    try {
      const response = await fetch(`http://localhost:5000/api/${activeSchema.name}/import-csv`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "CSV Import failed");
      }

      // Trigger system alert inside context if supported, or window alert fallback
      if (apiContext.setError) {
        apiContext.setError(`📥 CSV Import Success: Imported ${result.imported}/${result.total} records.`);
      } else {
        alert(`Imported ${result.imported}/${result.total} records`);
      }

      // Reset CSV selector
      setCsvFile(null);
      // Re-query collection
      await fetchRecords(activeSchema.name);
    } catch (err: any) {
      if (apiContext.setError) {
        apiContext.setError(`❌ CSV Import Error: ${err.message}`);
      } else {
        alert(`CSV Import failed: ${err.message}`);
      }
    } finally {
      setCsvImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="ds-form-card ds-skeleton-card">
        <div className="ds-skeleton-title skeleton"></div>
        <div className="ds-form-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="ds-form-group">
              <div className="ds-skeleton-label skeleton"></div>
              <div className="ds-skeleton-input skeleton"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (validFields.length === 0) {
    return (
      <div className="ds-form-card ds-empty-section">
        <h3 className="ds-section-heading">{sectionName}</h3>
        <div className="ds-empty-state-message">
          💡 This section contains no valid form input configurations.
        </div>
      </div>
    );
  }

  return (
    <div className="ds-form-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="ds-section-heading" style={{ marginBottom: 0 }}>{sectionName}</h3>
        
        {/* CSV Import Widget Panel */}
        <div className="ds-csv-import-panel" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          fontSize: '12px'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>CSV Import:</span>
          <input 
            type="file" 
            accept=".csv" 
            id="csv-file-picker"
            style={{ display: 'none' }}
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)} 
          />
          <label htmlFor="csv-file-picker" className="ds-btn ds-btn-secondary" style={{
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            margin: 0
          }}>
            {csvFile ? `📄 ${csvFile.name}` : '📁 Choose CSV'}
          </label>
          <button 
            onClick={handleCsvUpload} 
            disabled={!csvFile || csvImporting} 
            className="ds-btn ds-btn-primary" 
            style={{ padding: '4px 8px', fontSize: '11px', margin: 0 }}
          >
            {csvImporting ? 'Importing...' : '📥 Import CSV'}
          </button>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="ds-form-layout" noValidate>
        <div className="ds-form-grid">
          {validFields.map(field => (
            <FormFieldWrapper
              key={field.name}
              field={field}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={handleChange}
            />
          ))}
        </div>
        <div className="ds-form-actions">
          <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={reset}
            disabled={isSaving}
          >
            Clear Fields
          </button>
          <button
            type="submit"
            className="ds-btn ds-btn-primary"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="ds-loading-btn-spinner">Saving...</span>
            ) : (
              'Save Record'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormBuilder;
