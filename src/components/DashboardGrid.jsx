import React from 'react';
import ErrorBoundary from './ErrorBoundary';

// Helper component to render specific widget contents
function DashboardWidget({ widget }) {
  if (!widget || typeof widget !== 'object' || !widget.id) {
    return null;
  }

  const { title, type, value, subtext } = widget;
  const normalizedType = (type || 'metric').toLowerCase();

  return (
    <ErrorBoundary fieldName={title || widget.id}>
      <div className={`ds-widget-card ds-widget-${normalizedType}`}>
        <div className="ds-widget-header">
          <span className="ds-widget-title">{title || "Widget"}</span>
          <span className="ds-widget-icon">
            {normalizedType === 'metric' ? '📊' : normalizedType === 'chart' ? '📈' : '🔔'}
          </span>
        </div>
        
        <div className="ds-widget-body">
          {(() => {
            switch (normalizedType) {
              case 'metric':
                return (
                  <div className="ds-metric-container">
                    <span className="ds-metric-value">{value || '0'}</span>
                    {subtext && <span className="ds-metric-subtext">{subtext}</span>}
                  </div>
                );

              case 'chart':
                return (
                  <div className="ds-chart-container">
                    <div className="ds-chart-value-overlay">
                      <span className="ds-chart-val">{value || '$0'}</span>
                      <span className="ds-chart-lbl">{subtext || 'Monthly Target'}</span>
                    </div>
                    {/* CSS-only mini bar chart for premium aesthetic */}
                    <div className="ds-mini-bar-chart">
                      <div className="ds-chart-bar" style={{ height: '35%', '--bar-color': '#818cf8' }}></div>
                      <div className="ds-chart-bar" style={{ height: '55%', '--bar-color': '#6366f1' }}></div>
                      <div className="ds-chart-bar" style={{ height: '40%', '--bar-color': '#4f46e5' }}></div>
                      <div className="ds-chart-bar" style={{ height: '75%', '--bar-color': '#3b82f6' }}></div>
                      <div className="ds-chart-bar" style={{ height: '90%', '--bar-color': '#10b981' }}></div>
                    </div>
                  </div>
                );

              case 'activity':
              case 'list':
                return (
                  <div className="ds-activity-list">
                    <div className="ds-activity-item">
                      <span className="ds-dot ds-dot-green"></span>
                      <div className="ds-item-txt">
                        <p className="ds-item-msg">Database connection active</p>
                        <span className="ds-item-time">Just now</span>
                      </div>
                    </div>
                    <div className="ds-activity-item">
                      <span className="ds-dot ds-dot-blue"></span>
                      <div className="ds-item-txt">
                        <p className="ds-item-msg">Version cache synchronized</p>
                        <span className="ds-item-time">5 mins ago</span>
                      </div>
                    </div>
                    <div className="ds-activity-item">
                      <span className="ds-dot ds-dot-purple"></span>
                      <div className="ds-item-txt">
                        <p className="ds-item-msg">Mock session initialized</p>
                        <span className="ds-item-time">15 mins ago</span>
                      </div>
                    </div>
                  </div>
                );

              default:
                return (
                  <div className="ds-widget-fallback">
                    <p className="ds-fallback-value">{String(value || '')}</p>
                    <span className="ds-fallback-type">Type: {type}</span>
                  </div>
                );
            }
          })()}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export function DashboardGrid({ section, loading = false, error = null }) {
  const sectionName = section?.name || "Operations Dashboard";
  const widgets = section?.widgets || [];

  // Filter valid widgets
  const validWidgets = widgets.filter(
    w => w && typeof w === 'object' && w.id
  );

  // Skeletons loader state
  if (loading) {
    return (
      <div className="ds-dashboard-card ds-skeleton-card">
        <div className="ds-skeleton-title skeleton"></div>
        <div className="ds-dashboard-skeleton-grid">
          <div className="ds-skeleton-widget skeleton"></div>
          <div className="ds-skeleton-widget skeleton"></div>
          <div className="ds-skeleton-widget skeleton"></div>
        </div>
      </div>
    );
  }

  // Dashboard rendering errors
  if (error) {
    return (
      <div className="ds-dashboard-card ds-dashboard-error">
        <h3 className="ds-section-heading">{sectionName}</h3>
        <div className="ds-error-fallback-panel">
          <p className="ds-error-title">⚠️ Dashboard Render Error</p>
          <p className="ds-error-desc">{error}</p>
        </div>
      </div>
    );
  }

  // Empty dashboard widgets definition
  if (validWidgets.length === 0) {
    return (
      <div className="ds-dashboard-card">
        <h3 className="ds-section-heading">{sectionName}</h3>
        <div className="ds-empty-state-message">
          💡 This dashboard grid contains no valid widget definitions.
        </div>
      </div>
    );
  }

  return (
    <div className="ds-dashboard-card">
      <h3 className="ds-section-heading">{sectionName}</h3>
      <div className="ds-dashboard-grid-container">
        {validWidgets.map(widget => {
          // Compute CSS Grid coordinates dynamically from config values
          const gridConfig = widget.grid || {};
          const style = {
            gridColumn: gridConfig.w ? `span ${gridConfig.w}` : 'span 4',
            gridRow: gridConfig.h ? `span ${gridConfig.h}` : 'span 2'
          };
          
          // Optional exact position mapping if x/y offsets are provided
          if (gridConfig.x !== undefined) {
            style.gridColumnStart = gridConfig.x + 1;
            style.gridColumnEnd = `span ${gridConfig.w || 4}`;
          }
          if (gridConfig.y !== undefined) {
            style.gridRowStart = gridConfig.y + 1;
            style.gridRowEnd = `span ${gridConfig.h || 2}`;
          }

          return (
            <div key={widget.id} style={style} className="ds-grid-item">
              <DashboardWidget widget={widget} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardGrid;
