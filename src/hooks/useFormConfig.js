import { useState, useCallback, useEffect } from 'react';

// Manage state and inline validation for dynamic forms
export function useFormConfig(fields = [], initialData = null) {
  // Initialize default form values based on schema definitions
  const getDefaults = useCallback(() => {
    const defaults = {};
    fields.forEach(field => {
      if (!field || !field.name) return;
      
      if (initialData && initialData[field.name] !== undefined) {
        defaults[field.name] = initialData[field.name];
      } else if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      } else if (field.type === 'checkbox') {
        defaults[field.name] = false;
      } else {
        defaults[field.name] = '';
      }
    });
    return defaults;
  }, [fields, initialData]);

  const [values, setValues] = useState(getDefaults);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Sync state if initialData changes (e.g. edit mode load)
  useEffect(() => {
    setValues(getDefaults());
    setErrors({});
    setIsDirty(false);
  }, [initialData, getDefaults]);

  // Validates a single field
  const validateField = useCallback((field, val) => {
    if (!field || !field.name) return '';

    // Check required constraint
    const isEmpty = val === undefined || val === null || val === '';
    if (field.required && isEmpty) {
      return `${field.label || field.name} is required`;
    }

    if (isEmpty) return '';

    const type = (field.type || 'text').toLowerCase();
    
    // Check type formats
    if (type === 'email') {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(String(val))) {
        return "Invalid email address format";
      }
    }

    if (type === 'number') {
      if (isNaN(Number(val))) {
        return "Must be a valid number";
      }
    }

    // Check regex pattern (if defined)
    if (field.pattern) {
      try {
        const regex = new RegExp(field.pattern);
        if (!regex.test(String(val))) {
          return field.patternMessage || "Value does not match required format";
        }
      } catch (err) {
        console.warn("Invalid regex pattern defined in field config:", field.pattern);
      }
    }

    return '';
  }, []);

  // Update a single form value and validate it
  const handleChange = useCallback((name, value) => {
    setIsDirty(true);
    
    setValues(prev => ({
      ...prev,
      [name]: value
    }));

    const field = fields.find(f => f.name === name);
    if (field) {
      const fieldError = validateField(field, value);
      setErrors(prev => ({
        ...prev,
        [name]: fieldError
      }));
    }
  }, [fields, validateField]);

  // Validates the entire form
  const validate = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    fields.forEach(field => {
      if (!field || !field.name) return;
      const value = values[field.name];
      const errorMsg = validateField(field, value);
      if (errorMsg) {
        newErrors[field.name] = errorMsg;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [fields, values, validateField]);

  // Reset form to schema default state
  const reset = useCallback(() => {
    setValues(getDefaults());
    setErrors({});
    setIsDirty(false);
  }, [getDefaults]);

  return {
    values,
    errors,
    isDirty,
    handleChange,
    validate,
    reset,
    setErrors,
    setValues
  };
}

export default useFormConfig;
