import { create } from 'zustand';
import { apiClient } from '../lib/api';

// Local type definitions to avoid import issues
interface LoginCredentials {
  mobile_phone: string;
  pin: string;
}

interface LoginResponse {
  success: boolean;
  api_token?: string;
  sale_person_id?: number;
  sale_person_info?: {
    id: number;
    name: string;
    mobile_phone: string;
    store_location: number;
    store_location_name: string;
  };
  running_project?: {
    id: number;
    name: string;
    location_id: number;
    location_name: string;
    start_date: string;
  };
  available_racks?: Array<{
    id: number;
    name: string;
    location_id: number;
    location_name: string;
    note: string;
  }>;
  error?: string;
}

export interface SalePersonInfo {
  id: number;
  name: string;
  mobile_phone: string;
  store_location: number;
  store_location_name: string;
}

export interface ProjectInfo {
  id: number;
  name: string;
  location_id: number;
  location_name: string;
  start_date: string;
}

export interface RackInfo {
  id: number;
  name: string;
  location_id: number;
  location_name: string;
  note: string;
}

interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  apiToken: string | null;
  salePersonInfo: SalePersonInfo | null;
  runningProject: ProjectInfo | null;
  availableRacks: RackInfo[];
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  initializeFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: false,
  apiToken: null,
  salePersonInfo: null,
  runningProject: null,
  availableRacks: [],
  error: null,

  // Actions
  login: async (credentials: LoginCredentials): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      const response: LoginResponse = await apiClient.login(credentials);

      if (response.success && response.api_token) {
        // Save to localStorage (simple approach)
        localStorage.setItem('auth_token', response.api_token);
        localStorage.setItem('sale_person_info', JSON.stringify(response.sale_person_info || {}));
        localStorage.setItem('running_project', JSON.stringify(response.running_project || {}));
        localStorage.setItem('available_racks', JSON.stringify(response.available_racks || []));

        // Ensure API client has the token (redundant but safe)
        apiClient.setToken(response.api_token);

        set({
          isAuthenticated: true,
          isLoading: false,
          apiToken: response.api_token,
          salePersonInfo: response.sale_person_info || null,
          runningProject: response.running_project || null,
          availableRacks: response.available_racks || [],
          error: null
        });

        return true;
      } else {
        set({
          isLoading: false,
          error: response.error || 'Login failed'
        });
        return false;
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Network error during login'
      });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    set({ isLoading: true });

    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('sale_person_info');
      localStorage.removeItem('running_project');
      localStorage.removeItem('available_racks');
      apiClient.clearToken();
      
      set({
        isAuthenticated: false,
        isLoading: false,
        apiToken: null,
        salePersonInfo: null,
        runningProject: null,
        availableRacks: [],
        error: null
      });
    }
  },

  refreshToken: async (): Promise<boolean> => {
    const { apiToken } = get();
    if (!apiToken) return false;

    try {
      const response = await apiClient.refreshToken();
      
      if (response.success && response.api_token) {
        const currentAuth = await offlineStorage.getAuthData();
        if (currentAuth) {
          const updatedAuth: AuthData = {
            ...currentAuth,
            apiToken: response.api_token,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
          };
          await offlineStorage.saveAuthData(updatedAuth);
        }

        set({ apiToken: response.api_token });
        return true;
      } else {
        // Token refresh failed, logout
        await get().logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await get().logout();
      return false;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  initializeFromStorage: async (): Promise<void> => {
    set({ isLoading: true });

    try {
      const authToken = localStorage.getItem('auth_token');
      const salePersonInfo = localStorage.getItem('sale_person_info');
      const runningProject = localStorage.getItem('running_project');
      const availableRacks = localStorage.getItem('available_racks');

      if (authToken) {
        // Set token in API client
        apiClient.setToken(authToken);

        set({
          isAuthenticated: true,
          isLoading: false,
          apiToken: authToken,
          salePersonInfo: salePersonInfo ? JSON.parse(salePersonInfo) : null,
          runningProject: runningProject ? JSON.parse(runningProject) : null,
          availableRacks: availableRacks ? JSON.parse(availableRacks) : [],
          error: null
        });

        // Try to refresh token in background
        get().refreshToken().catch(console.error);
      } else {
        // No auth data found
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error initializing from storage:', error);
      set({ isLoading: false });
    }
  }
}));

// Listen for auth logout events (from API interceptor)
window.addEventListener('auth:logout', () => {
  useAuthStore.getState().logout();
});

// Auto-refresh token before expiration
setInterval(async () => {
  const { isAuthenticated, refreshToken } = useAuthStore.getState();
  if (isAuthenticated) {
    await refreshToken();
  }
}, 23 * 60 * 60 * 1000); // Refresh every 23 hours
