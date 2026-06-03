import React, { useState, useMemo, useEffect } from 'react';

export interface TableColumn {
  key: string;
  header?: string;
  sortable?: boolean;
}

export interface TableRendererProps {
  section: {
    name: string;
    columns?: (TableColumn | string)[];
    sortable?: boolean;
    filterable?: boolean;
  };
  records?: Record<string, any>[];
  onEdit?: (record: Record<string, any>) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}

export const TableRenderer: React.FC<TableRendererProps> = ({ 
  section, 
  records = [], 
  onEdit, 
  onDelete, 
  loading = false, 
  error = null 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  const sectionName = section?.name || "Data Records Table";

  // Normalize column definitions from section schema (handles strings & objects)
  const columns = useMemo<TableColumn[]>(() => {
    const rawColumns = section?.columns;
    if (rawColumns && Array.isArray(rawColumns) && rawColumns.length > 0) {
      return rawColumns.map(c => {
        if (typeof c === 'string') {
          return {
            key: c,
            header: c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '),
            sortable: section.sortable !== false
          };
        }
        return {
          key: c.key,
          header: c.header || c.key,
          sortable: c.sortable !== false && section.sortable !== false
        };
      });
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

  // Set visible column keys (toggleable)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Re-sync visible columns whenever columns definition updates
  useEffect(() => {
    if (columns.length > 0) {
      setVisibleKeys(new Set(columns.map(c => c.key)));
    }
  }, [columns]);

  // Handle header sorting click toggles
  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Toggle single column visibility
  const toggleColumnVisibility = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Prevent hiding the last column
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Filter columns based on visibility state
  const visibleColumns = useMemo(() => {
    return columns.filter(col => visibleKeys.has(col.key));
  }, [columns, visibleKeys]);

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
  const renderCell = (value: any, columnKey: string) => {
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

    // Format timestamps nicely
    if (columnKey === 'created_at' || columnKey === 'updated_at') {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return String(value);
      }
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
        <h3 className="ds-section-heading" style={{ marginBottom: 0 }}>{sectionName}</h3>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Column Visibility Selector Toggle */}
          <div style={{ position: 'relative' }}>
            <button 
              className="ds-btn ds-btn-secondary" 
              style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setShowColumnDropdown(prev => !prev)}
            >
              ⚙️ Columns ({visibleColumns.length}/{columns.length})
            </button>
            {showColumnDropdown && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '40px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: 'var(--card-shadow)',
                zIndex: 10,
                minWidth: '160px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Toggle Columns:</span>
                {columns.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={visibleKeys.has(col.key)} 
                      onChange={() => toggleColumnVisibility(col.key)} 
                      disabled={visibleKeys.has(col.key) && visibleKeys.size === 1}
                    />
                    <span>{col.header || col.key}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

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
        <div className="ds-table-responsive-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="ds-table" style={{ width: '100%', minWidth: '600px' }}>
            <thead>
              <tr>
                {visibleColumns.map(col => (
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
                  {visibleColumns.map(col => (
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
                            onClick={() => onDelete(row.id)}
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
};

export default TableRenderer;
