import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Create central state Context for DynamicStack runtime configuration
const DynamicStackContext = createContext(null);

const API_BASE_URL = 'http://localhost:5000/api';

// Provider Component wrapping the Application root
export function DynamicStackProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('ds_token') || '');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('ds_user');
    return saved ? JSON.parse(saved) : { id: 'user_1', username: 'alice_admin', role: 'admin' };
  });

  const [activeSchema, setActiveSchema] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync token to storage on changes
  useEffect(() => {
    if (authToken) {
      localStorage.setItem('ds_token', authToken);
    } else {
      localStorage.removeItem('ds_token');
    }
  }, [authToken]);

  // Sync user details to storage on changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('ds_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('ds_user');
    }
  }, [currentUser]);

  // Helper to request a new JWT from mock auth switcher
  const changeUser = useCallback(async (userId, username, role) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, username, role })
      });

      if (!response.ok) {
        throw new Error("Authentication switch failed");
      }

      const payload = await response.json();
      setAuthToken(payload.token);
      setCurrentUser(payload.user);
      return payload.user;
    } catch (err) {
      console.error(err);
      setError("Failed to switch user role context");
    } finally {
      setLoading(false);
    }
  }, []);

  // Make sure we have a token initially if we don't have one
  useEffect(() => {
    if (!authToken && currentUser) {
      changeUser(currentUser.id, currentUser.username, currentUser.role);
    }
  }, [authToken, currentUser, changeUser]);

  // Translate raw API/DB error payloads into friendly UI alerts
  const translateError = useCallback((payload, httpStatus) => {
    if (!payload) return "A connection error occurred. Check if the server is running.";
    if (typeof payload === 'string') return payload;

    const { error: errorText, code, fields } = payload;
    
    if (code === 'VALIDATION_ERROR') {
      return errorText.replace("Missing required field:", "Please provide a value for required field:");
    }

    if (code === 'DUPLICATE_ENTRY') {
      return "An entry with duplicate key details already exists in the database.";
    }

    if (code === 'RESOURCE_NOT_FOUND') {
      return "The requested record could not be found or has been deleted.";
    }

    if (code === 'SCHEMA_NOT_FOUND') {
      return "This app schema resource is not registered on the backend.";
    }

    if (code === 'FORBIDDEN' || httpStatus === 403) {
      return "Forbidden: You are not authorized to view or edit this resource record.";
    }

    if (code === 'UNAUTHORIZED' || httpStatus === 401) {
      return "Your session has expired. Toggling user context should sign you back in.";
    }

    if (code === 'INVALID_DATA_TYPE') {
      return "Database rejected operation due to invalid field type formats.";
    }

    if (errorText === "Validation failed" && fields) {
      return `Validation failed on inputs: ${fields.map(f => f.field + " (" + f.message + ")").join(', ')}`;
    }

    return errorText || "An unexpected system error occurred. Please try again.";
  }, []);

  // Process X-Schema response headers for local storage caches and version syncs
  const syncSchemaCache = useCallback((resource, headers) => {
    const xSchemaHeader = headers.get('X-Schema');
    if (!xSchemaHeader) return;

    try {
      const serverSchema = JSON.parse(xSchemaHeader);
      const cacheKey = `ds_schema_${resource}`;
      const cachedString = localStorage.getItem(cacheKey);

      if (!cachedString) {
        localStorage.setItem(cacheKey, JSON.stringify(serverSchema));
        setActiveSchema(serverSchema);
        console.log(`[Cache Sync] Saved initial schema configuration for ${resource} (v${serverSchema.version})`);
      } else {
        const cachedSchema = JSON.parse(cachedString);
        if (cachedSchema.version !== serverSchema.version || cachedSchema.id !== serverSchema.id) {
          localStorage.setItem(cacheKey, JSON.stringify(serverSchema));
          setActiveSchema(serverSchema);
          console.log(`[Cache Sync] Detected version mismatch! Upgraded ${resource} schema layout to v${serverSchema.version}`);
        } else if (!activeSchema || activeSchema.id !== cachedSchema.id) {
          setActiveSchema(cachedSchema);
        }
      }
    } catch (err) {
      console.warn("Failed to parse X-Schema header configuration:", err);
    }
  }, [activeSchema]);

  // Load collection data dynamically
  const fetchRecords = useCallback(async (resource) => {
    setLoading(true);
    setError(null);
    try {
      const cacheKey = `ds_schema_${resource}`;
      const localSchema = localStorage.getItem(cacheKey);
      if (localSchema && !activeSchema) {
        setActiveSchema(JSON.parse(localSchema));
      }

      const response = await fetch(`${API_BASE_URL}/${resource}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      syncSchemaCache(resource, response.headers);

      const data = await response.json();
      if (!response.ok) {
        throw { payload: data, status: response.status };
      }

      setRecords(data);
      return data;
    } catch (err) {
      const errMsg = translateError(err.payload, err.status);
      setError(errMsg);
      setRecords([]);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [authToken, activeSchema, syncSchemaCache, translateError]);

  // Create database record
  const createRecord = useCallback(async (resource, payload) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${resource}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      syncSchemaCache(resource, response.headers);

      const data = await response.json();
      if (!response.ok) {
        throw { payload: data, status: response.status };
      }

      // Prepend record to state
      setRecords(prev => [data, ...prev]);
      return data;
    } catch (err) {
      const errMsg = translateError(err.payload, err.status);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [authToken, syncSchemaCache, translateError]);

  // Update database record
  const updateRecord = useCallback(async (resource, id, payload) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${resource}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      syncSchemaCache(resource, response.headers);

      const data = await response.json();
      if (!response.ok) {
        throw { payload: data, status: response.status };
      }

      // Update local state record
      setRecords(prev => prev.map(r => r.id === id ? data : r));
      return data;
    } catch (err) {
      const errMsg = translateError(err.payload, err.status);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [authToken, syncSchemaCache, translateError]);

  // Delete database record
  const deleteRecord = useCallback(async (resource, id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${resource}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      syncSchemaCache(resource, response.headers);

      const data = await response.json();
      if (!response.ok) {
        throw { payload: data, status: response.status };
      }

      // Filter out deleted record
      setRecords(prev => prev.filter(r => r.id !== id));
      return data;
    } catch (err) {
      const errMsg = translateError(err.payload, err.status);
      setError(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [authToken, syncSchemaCache, translateError]);

  const value = {
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
    setActiveSchema,
    setError
  };

  return React.createElement(
    DynamicStackContext.Provider,
    { value: value },
    children
  );
}

// Hook consumer
export function useApiConfig() {
  const context = useContext(DynamicStackContext);
  if (!context) {
    throw new Error("useApiConfig must be consumed inside a DynamicStackProvider");
  }
  return context;
}
