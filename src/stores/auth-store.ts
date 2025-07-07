import { create } from 'zustand';
import { apiClient, LoginCredentials, LoginResponse } from '../lib/api';
import { offlineStorage, AuthData } from '../lib/offline-storage';

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
        const authData: AuthData = {
          apiToken: response.api_token,
          salePersonInfo: response.sale_person_info || null,
          runningProject: response.running_project || null,
          availableRacks: response.available_racks || [],
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };

        // Save to offline storage
        await offlineStorage.saveAuthData(authData);

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
      // Clear local state and storage regardless of API call result
      await offlineStorage.clearAuthData();
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
      const authData = await offlineStorage.getAuthData();
      
      if (authData && authData.expiresAt > Date.now()) {
        // Set token in API client
        apiClient.setToken(authData.apiToken);

        set({
          isAuthenticated: true,
          isLoading: false,
          apiToken: authData.apiToken,
          salePersonInfo: authData.salePersonInfo,
          runningProject: authData.runningProject,
          availableRacks: authData.availableRacks,
          error: null
        });

        // Try to refresh token in background
        get().refreshToken().catch(console.error);
      } else {
        // Auth data expired or doesn't exist
        await offlineStorage.clearAuthData();
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
