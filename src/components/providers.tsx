'use client';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
  }
}
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok)
    throw new ApiError(
      data.error?.message ?? 'ارتباط با سرویس برقرار نشد.',
      res.status,
      data.error?.code ?? 'NETWORK'
    );
  return data;
}
export const post = <T = unknown,>(
  path: string,
  data: unknown = {},
  headers?: Record<string, string>
) => api<T>(path, { method: 'POST', body: JSON.stringify(data), headers });
const Context = createContext<{
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  toast: (text: string, error?: boolean) => void;
}>({ user: null, loading: true, refresh: async () => {}, toast: () => {} });
export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const refresh = useCallback(async () => {
    try {
      setUser((await api<{ user: User | null }>('auth/session')).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(t);
    }
  }, [message]);
  const toast = useCallback((text: string, error = false) => setMessage({ text, error }), []);
  return (
    <Context.Provider value={{ user, loading, refresh, toast }}>
      {children}
      {message && (
        <div className={`toast ${message.error ? 'toast-error' : ''}`} role="status">
          {message.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label="بستن پیام">
            <X size={17} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای ارتباط');
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
