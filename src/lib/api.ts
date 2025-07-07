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

  // Get submissions for dashboard
  async getSubmissions(projectId?: number, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    submissions?: Array<{
      id: number;
      name: string;
      project_id: number;
      project_name: string;
      submission_datetime: string;
      state: string;
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
  }> {
    try {
      const response = await fetch(`${this.baseURL}/inventory_app/get_submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          params: {
            api_token: this.apiToken,
            project_id: projectId,
            limit,
            offset,
            order: 'id desc'
          }
        })
      });

      const data = await response.json();

      if (data.result) {
        return {
          success: data.result.success,
          submissions: data.result.submissions,
          pagination: data.result.pagination,
          error: data.result.error
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch submissions'
      };
    }
  }

  // Get scan lines for a specific submission
  async getSubmissionScanLines(submissionId: number): Promise<{
    success: boolean;
    submission_id?: number;
    submission_name?: string;
    scan_count?: number;
    scan_lines?: Array<{
      id: number;
      lot_id: number;
      lot_name: string;
      product_id: number;
      product_name: string;
      scanned_qty: number;
      theoretical_qty: number;
      change_qty: number;
      state: string;
      rack_id: number | false;
      rack_name: string;
    }>;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/inventory_app/get_submission_scan_lines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          params: {
            api_token: this.apiToken,
            submission_id: submissionId,
            order: 'product_id asc, lot_name asc'
          }
        })
      });

      const data = await response.json();

      if (data.result) {
        return {
          success: data.result.success,
          submission_id: data.result.submission_id,
          submission_name: data.result.submission_name,
          scan_count: data.result.scan_count,
          scan_lines: data.result.scan_lines,
          error: data.result.error
        };
      } else {
        return {
          success: false,
          error: 'Invalid response format'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch scan lines'
      };
    }
  }

  // Find product by lot name (when user scans a lot first)
  async findProductByLot(lotName: string, locationId: number): Promise<{
    success: boolean;
    product_info?: {
      product_id: number;
      product_name: string;
      product_code: string;
      lots: Array<{
        lot_id: number;
        lot_name: string;
        theoretical_qty: number;
        expiry_date?: string;
      }>;
    };
    error?: string;
  }> {
    try {
      // Mock lot-to-product mapping
      const lotToProductMap: { [key: string]: string } = {
        // Skin Cafe Almond Oil lots
        "0099986": "1001",
        "0099987": "1001",
        "0099988": "1001",

        // Panam Care Herbal Glow Facial Kit lots
        "0099362": "22027",
        "0099363": "22027",
        "0099364": "22027",
        "0099365": "22027",

        // Natural Hair Shampoo lots
        "LOT001": "5678",
        "LOT002": "5678"
      };

      const productCode = lotToProductMap[lotName];
      if (productCode) {
        // Get all lots for this product
        return this.getProductLots(productCode, locationId);
      } else {
        // Try real API call for lots not in mock data
        const lotResponse = await this.getLotInfo(lotName, locationId);

        if (lotResponse.success && lotResponse.data && lotResponse.data.length > 0) {
          const lotData = lotResponse.data[0];

          // Build product info from real API response
          const productInfo = {
            product_id: lotData.product_id,
            product_name: lotData.product_name,
            product_code: lotData.product_code,
            lots: lotData.product_lots?.map(lot => ({
              lot_id: lot.lot_id,
              lot_name: lot.lot_name,
              theoretical_qty: lot.lot_stock || 0,
              expiry_date: undefined // Not provided in current API
            })) || []
          };

          return {
            success: true,
            product_info: productInfo
          };
        } else {
          return {
            success: false,
            error: "Lot not found"
          };
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to find product by lot'
      };
    }
  }

  // Get all lots for a product
  async getProductLots(productCode: string, locationId: number): Promise<{
    success: boolean;
    product_info?: {
      product_id: number;
      product_name: string;
      product_code: string;
      lots: Array<{
        lot_id: number;
        lot_name: string;
        theoretical_qty: number;
        expiry_date?: string;
      }>;
    };
    error?: string;
  }> {
    try {
      // Mock data for different products
      const mockProducts: { [key: string]: any } = {
        "1001": {
          product_id: 6938,
          product_name: "Skin Cafe Almond Oil (Cold Pressed)",
          product_code: "1001",
          lots: [
            { lot_id: 103123, lot_name: "0099986", theoretical_qty: 20, expiry_date: "2025-12-31" },
            { lot_id: 103124, lot_name: "0099987", theoretical_qty: 15, expiry_date: "2025-11-30" },
            { lot_id: 103125, lot_name: "0099988", theoretical_qty: 8, expiry_date: "2025-10-15" },
          ]
        },
        "22027": {
          product_id: 1234,
          product_name: "Panam Care Herbal Glow Facial Kit",
          product_code: "22027",
          lots: [
            { lot_id: 201001, lot_name: "0099362", theoretical_qty: 8, expiry_date: "2025-03-15" },
            { lot_id: 201002, lot_name: "0099363", theoretical_qty: 12, expiry_date: "2025-04-20" },
            { lot_id: 201003, lot_name: "0099364", theoretical_qty: 5, expiry_date: "2025-05-10" },
            { lot_id: 201004, lot_name: "0099365", theoretical_qty: 18, expiry_date: "2025-06-05" },
          ]
        },
        "5678": {
          product_id: 5678,
          product_name: "Natural Hair Shampoo",
          product_code: "5678",
          lots: [
            { lot_id: 301001, lot_name: "LOT001", theoretical_qty: 25, expiry_date: "2025-08-15" },
            { lot_id: 301002, lot_name: "LOT002", theoretical_qty: 30, expiry_date: "2025-09-20" },
          ]
        }
      };

      const product = mockProducts[productCode];
      if (product) {
        return {
          success: true,
          product_info: product
        };
      } else {
        return {
          success: false,
          error: "Product not found"
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get product lots'
      };
    }
  }

  // Lot Information
  async getLotInfo(lotName: string, locationId: number): Promise<LotInfoResponse> {
    try {
      const response: AxiosResponse<{jsonrpc: string, id: any, result: LotInfoResponse}> = await this.client.post(
        '/inventory_app/get_lot_info',
        {
          params: {
            api_token: this.token,
            lot_name: lotName,
            location_id: locationId
          }
        }
      );
      return response.data.result;
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
