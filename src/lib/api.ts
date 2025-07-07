import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';

// API Types
export interface LoginCredentials {
  mobile_phone: string;
  pin: string;
}

export interface LoginResponse {
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

export interface LotInfoRequest {
  api_token: string;
  lot_name: string;
  location_id: number;
}

export interface LotInfoResponse {
  success: boolean;
  data?: Array<{
    lot_id: number;
    product_id: number;
    product_name?: string;
    lot_inventoried_stock: number;
    lot_stock: number;
    product_stock: number;
    product_lots: Array<{
      lot_id: number;
      product_id: number;
      lot_inventoried_stock: number;
      lot_stock: number;
      product_stock: number;
    }>;
  }>;
  error?: string;
}

export interface CreateSubmissionRequest {
  api_token: string;
  project_id: number;
  rack_id?: number;
  notes?: string;
  scan_lines: Array<{
    lot_name?: string;
    lot_id?: number;
    scanned_qty: number;
    rack_id?: number;
    notes?: string;
  }>;
  previous_submission_id?: number;
  scanned_lot_name?: string;
}

export interface CreateSubmissionResponse {
  success: boolean;
  submission_id?: number;
  submission_reference?: string;
  scan_lines?: Array<{
    lot_name: string;
    lot_id: number;
    success: boolean;
    product_id?: number;
    product_name?: string;
    scan_id?: number;
    error?: string;
  }>;
  valid_lines?: number;
  invalid_lines?: number;
  is_reinventory?: boolean;
  previous_submission_id?: number;
  previous_submission_reference?: string;
  error?: string;
}

export interface UpdateSubmissionRequest {
  api_token: string;
  submission_id: number;
  scan_lines_to_add?: Array<{
    lot_name?: string;
    lot_id?: number;
    scanned_qty: number;
    rack_id?: number;
    notes?: string;
  }>;
  scan_lines_to_update?: Array<{
    scan_line_id: number;
    scanned_qty?: number;
    rack_id?: number;
    notes?: string;
  }>;
  scan_lines_to_remove?: number[];
}

export interface GetSubmissionsRequest {
  api_token: string;
  project_id?: number;
  limit?: number;
  offset?: number;
  order?: string;
}

export interface GetSubmissionsResponse {
  success: boolean;
  submissions?: Array<{
    id: number;
    name: string;
    project_id: number;
    project_name: string;
    submission_datetime: string;
    state: 'draft' | 'submitted' | 'validated' | 'rejected';
    scan_count: number;
    validated_count: number;
    rack_id: number | false;
    rack_name: string;
    notes: string;
  }>;
  pagination?: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  error?: string;
}

// API Client Class
class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = import.meta.env.VITE_API_BASE_URL || 'https://t.shajgoj.store') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // Increased timeout for Odoo
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Handle CORS for Odoo
      withCredentials: false,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers['Authorization'] = this.token;
        config.headers['api_token'] = this.token;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle Odoo-specific errors
        if (error.response?.status === 401) {
          this.clearToken();
          // Trigger logout/redirect to login
          window.dispatchEvent(new CustomEvent('auth:logout'));
        } else if (error.response?.status === 403) {
          console.error('Access forbidden - check user permissions');
        } else if (error.response?.status >= 500) {
          console.error('Odoo server error:', error.response?.data);
        } else if (error.code === 'NETWORK_ERROR' || !error.response) {
          console.error('Network error - check connection to Odoo server');
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log('🚀 API Client sending:', { params: credentials });

      const response: AxiosResponse<{jsonrpc: string, id: any, result: LoginResponse}> = await this.client.post(
        '/inventory_app/login',
        { params: credentials }
      );

      const result = response.data.result;

      if (result.success && result.api_token) {
        this.setToken(result.api_token);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.result?.error || error.response?.data?.error || 'Login failed'
      };
    }
  }

  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post('/inventory_app/logout', {
        api_token: this.token
      });
      this.clearToken();
      return { success: true };
    } catch (error: any) {
      this.clearToken();
      return {
        success: false,
        error: error.response?.data?.error || 'Logout failed'
      };
    }
  }

  async refreshToken(): Promise<{ success: boolean; api_token?: string; error?: string }> {
    try {
      const response = await this.client.post('/inventory_app/refresh_token', {
        api_token: this.token
      });
      
      if (response.data.success && response.data.api_token) {
        this.setToken(response.data.api_token);
      }
      
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Token refresh failed'
      };
    }
  }

  // Lot Information
  async getLotInfo(lotName: string, locationId: number): Promise<LotInfoResponse> {
    try {
      const response: AxiosResponse<LotInfoResponse> = await this.client.post(
        '/inventory_app/get_lot_info',
        {
          api_token: this.token,
          lot_name: lotName,
          location_id: locationId
        }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get lot info'
      };
    }
  }

  // Submissions
  async createSubmission(data: CreateSubmissionRequest): Promise<CreateSubmissionResponse> {
    try {
      const response: AxiosResponse<CreateSubmissionResponse> = await this.client.post(
        '/inventory_app/create_submission',
        { ...data, api_token: this.token }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create submission'
      };
    }
  }

  async updateSubmission(data: UpdateSubmissionRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.post(
        '/inventory_app/update_submission',
        { ...data, api_token: this.token }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update submission'
      };
    }
  }

  async getSubmissions(data: GetSubmissionsRequest): Promise<GetSubmissionsResponse> {
    try {
      const response: AxiosResponse<GetSubmissionsResponse> = await this.client.post(
        '/inventory_app/get_submissions',
        { ...data, api_token: this.token }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get submissions'
      };
    }
  }

  // Check if lot belongs to previous submissions (for re-inventory detection)
  async checkPreviousSubmissions(lotName: string, projectId: number): Promise<GetSubmissionsResponse> {
    return this.getSubmissions({
      api_token: this.token!,
      project_id: projectId,
      limit: 10,
      order: 'submission_datetime desc'
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Network status utilities
export const isOnline = () => navigator.onLine;

export const waitForOnline = (): Promise<void> => {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve();
    } else {
      const handleOnline = () => {
        window.removeEventListener('online', handleOnline);
        resolve();
      };
      window.addEventListener('online', handleOnline);
    }
  });
};
