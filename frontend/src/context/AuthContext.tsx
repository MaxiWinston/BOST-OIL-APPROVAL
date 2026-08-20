import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User, UserRole } from '../types';
import { authApi, tokens, ApiError } from '../lib/api';

interface AuthContextType {
  user: User | null;
  /** Resolves to the signed-in user, or throws with a message to display. */
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  /** True while the stored token is being validated on first load. */
  initialising: boolean;
  updateUser: (changes: Partial<User>) => Promise<void>;
  users: User[];
  refreshUsers: () => Promise<void>;
  addUser: (user: Partial<User> & { password: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [initialising, setInitialising] = useState(true);

  // Restore the session from a stored token so a refresh doesn't log you out.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokens.access) {
        setInitialising(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setInitialising(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const loggedIn = await authApi.login(username, password);
      setUser(loggedIn);
      return loggedIn;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new Error('Invalid username or password');
      }
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setUsers([]);
  }, []);

  const updateUser = useCallback(async (changes: Partial<User>) => {
    const updated = await authApi.updateMe(changes);
    setUser(updated);
  }, []);

  const refreshUsers = useCallback(async () => {
    const page = await authApi.listUsers();
    setUsers(page.results);
  }, []);

  const addUser = useCallback(
    async (newUser: Partial<User> & { password: string }) => {
      await authApi.createUser(newUser);
      await refreshUsers();
    },
    [refreshUsers],
  );

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    userRole: user?.role ?? null,
    initialising,
    updateUser,
    users,
    refreshUsers,
    addUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
