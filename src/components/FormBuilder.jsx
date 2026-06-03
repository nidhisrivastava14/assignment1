import React from 'react';
import useFormConfig from '../hooks/useFormConfig';
import ErrorBoundary from './ErrorBoundary';

// Individual field renderer wrapper with isolated ErrorBoundary fallback
function FormFieldWrapper({ field, value, error, onChange }) {
  // Silent fail if definition is invalid or missing name
  if (!field || typeof field !== 'object' || !field.name) {
    return null;
  }

  const { name, label, type, placeholder, options } = field;
  const normalizedType = (type || 'text').toLowerCase();

  const handleInputChange = (e) => {
    const val = normalizedType === 'checkbox' ? e.target.checked : e.target.value;
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
              // Unknown field type: render as read-only text block
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

export function FormBuilder({ section, onSubmit, initialData = null, isSaving = false, loading = false }) {
  // Graceful degradation: invalid section checks
  if (!section || typeof section !== 'object') {
    return (
      <div className="ds-section-fallback ds-section-error">
        [Section Configuration Error] - Invalid or missing section structure.
      </div>
    );
  }

  const sectionName = section.name || "Form Section";
  const fields = section.fields || [];
  
  // Filter out completely invalid or missing field definitions
  const validFields = fields.filter(
    f => f && typeof f === 'object' && f.name
  );

  const { values, errors, handleChange, validate, reset } = useFormConfig(validFields, initialData);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  };

  // Rendering Loading Skeleton state
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

  // Section with no valid fields: render an empty container (not nothing)
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
      <h3 className="ds-section-heading">{sectionName}</h3>
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
}

export default FormBuilder;
