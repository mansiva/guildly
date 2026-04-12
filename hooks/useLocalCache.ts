'use client';

import { useEffect, useState } from 'react';

/**
 * Persist and restore a value to/from localStorage.
 * Returns [value, setValue] where setValue also writes to localStorage.
 * On mount, initialises from cache immediately (before any async fetch).
 */
export function useLocalCache<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValueState] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  function setValue(v: T) {
    setValueState(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // storage quota — fail silently
    }
  }

  return [value, setValue];
}
