import React, { useState, useMemo } from 'react';

export function TableRenderer({ section, records = [], onEdit, onDelete, loading = false, error = null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  const sectionName = section?.name || "Data Records Table";

  // Graceful degradation: determine columns dynamically from records if not defined in schema
  const columns = useMemo(() => {
    if (section?.columns && Array.isArray(section.columns) && section.columns.length > 0) {
      return section.columns.filter(c => c && typeof c === 'object');
    }
    
    // Fallback: derive columns from data keys
    if (records.length > 0) {
      const keys = Object.keys(records[0]).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
      return keys.map(k => ({
        key: k,
        header: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
        sortable: true
      }));
    }
    
    return [];
  }, [section, records]);

  // Handle header sorting click toggles
  const handleSort = (key, sortable) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter and Sort records locally
  const processedRecords = useMemo(() => {
    let result = [...records];

    // 1. Search Filter
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      result = result.filter(rec => {
        return Object.entries(rec).some(([key, val]) => {
          if (key === 'id' || key === 'created_at' || key === 'updated_at') return false;
          return String(val).toLowerCase().includes(query);
        });
      });
    }

    // 2. Sorting
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        const strA = typeof valA === 'number' ? valA : String(valA).toLowerCase();
        const strB = typeof valB === 'number' ? valB : String(valB).toLowerCase();

        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, searchTerm, sortKey, sortDirection]);

  // Render Cell content gracefully
  const renderCell = (value, columnKey) => {
    if (value === undefined || value === null) {
      return <span className="ds-table-null-cell">—</span>;
    }
    if (typeof value === 'boolean') {
      return (
        <span className={`ds-table-badge ${value ? 'ds-badge-success' : 'ds-badge-secondary'}`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }
    if (typeof value === 'object') {
      return <span className="ds-table-json-cell">[Object]</span>;
    }
    
    // Check if column indicates email or date format
    if (columnKey.toLowerCase().includes('email')) {
      return <a href={`mailto:${value}`} className="ds-table-email-link">{value}</a>;
    }
    
    return String(value);
  };

  // Loading skeleton layout
  if (loading) {
    return (
      <div className="ds-table-card ds-skeleton-card">
        <div className="ds-skeleton-title skeleton"></div>
        <div className="ds-table-skeleton-rows">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="ds-table-skeleton-row skeleton"></div>
          ))}
        </div>
      </div>
    );
  }

  // Error boundary fallback / API failure
  if (error) {
    return (
      <div className="ds-table-card ds-table-error">
        <h3 className="ds-section-heading">{sectionName}</h3>
        <div className="ds-error-fallback-panel">
          <p className="ds-error-title">⚠️ Failed to load records</p>
          <p className="ds-error-desc">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-table-card">
      <div className="ds-table-header-row">
        <h3 className="ds-section-heading">{sectionName}</h3>
        {records.length > 0 && (
          <div className="ds-search-wrapper">
            <input
              type="text"
              placeholder="Search records..."
              className="ds-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="ds-search-clear-btn" onClick={() => setSearchTerm('')}>
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {columns.length === 0 ? (
        <div className="ds-empty-table-state">
          <div className="ds-empty-icon">📭</div>
          <p className="ds-empty-title">No structure defined</p>
          <p className="ds-empty-subtitle">Provide column metadata or insert data to view table cells.</p>
        </div>
      ) : processedRecords.length === 0 ? (
        <div className="ds-empty-table-state">
          <div className="ds-empty-icon">📂</div>
          <p className="ds-empty-title">{searchTerm ? 'No results found' : 'No records exist yet'}</p>
          <p className="ds-empty-subtitle">
            {searchTerm 
              ? 'Try modifying your search filter.' 
              : 'Add some records through the form config builder to populate this database.'}
          </p>
        </div>
      ) : (
        <div className="ds-table-responsive-container">
          <table className="ds-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key, col.sortable)}
                    className={col.sortable ? 'ds-th-sortable' : ''}
                  >
                    <div className="ds-th-content">
                      <span>{col.header || col.key}</span>
                      {col.sortable && sortKey === col.key && (
                        <span className="ds-sort-arrow">
                          {sortDirection === 'asc' ? ' ▲' : ' ▼'}
                        </span>
                      )}
                      {col.sortable && sortKey !== col.key && (
                        <span className="ds-sort-arrow-muted"> ⇅</span>
                      )}
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete) && <th style={{ width: '120px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {processedRecords.map(row => (
                <tr key={row.id}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {renderCell(row[col.key], col.key)}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td>
                      <div className="ds-table-actions">
                        {onEdit && (
                          <button
                            className="ds-action-btn ds-edit-btn"
                            title="Edit Record"
                            onClick={() => onEdit(row)}
                          >
                            ✏️
                          </button>
                        )}
                        {onDelete && (
                          <button
                            className="ds-action-btn ds-delete-btn"
                            title="Delete Record"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this record?")) {
                                onDelete(row.id);
                              }
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ds-table-footer">
            Showing {processedRecords.length} of {records.length} total records
          </div>
        </div>
      )}
    </div>
  );
}

export default TableRenderer;
