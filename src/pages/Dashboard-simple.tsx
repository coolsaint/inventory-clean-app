import React, { useState, useEffect } from 'react';
import { Search, Package, CheckCircle, Clock, AlertCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { apiClient } from '../lib/api';

// Product interface for dashboard
interface DashboardProduct {
  id: number;
  code: string;
  name: string;
  totalLots: number;
  theoretical: number;
  scanned: number;
  status: 'pending' | 'partial' | 'complete';
  rack: string;
  lots: Array<{
    id: string;
    theoretical: number;
    scanned: number | null;
    expiry?: string;
  }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { runningProject, availableRacks, salePersonInfo, logout } = useAuthStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [runningProject]);

  const loadDashboardData = async () => {
    if (!runningProject) return;
    
    setIsLoading(true);
    try {
      // Get submissions for the current project
      const submissionsResponse = await apiClient.getSubmissions(runningProject.id, 100, 0);
      
      if (submissionsResponse.success && submissionsResponse.submissions) {
        // Transform submissions into dashboard products
        const dashboardProducts = await transformSubmissionsToProducts(submissionsResponse.submissions);
        console.log('Dashboard: Using real API data, products:', dashboardProducts);
        setProducts(dashboardProducts);
      } else {
        console.error('Failed to load submissions:', submissionsResponse.error);
        console.log('Dashboard: Falling back to mock data');
        // Fallback to mock data
        setProducts(getMockProducts());
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      console.log('Dashboard: Exception occurred, falling back to mock data');
      // Fallback to mock data
      setProducts(getMockProducts());
    } finally {
      setIsLoading(false);
    }
  };

  // Transform submissions data into dashboard products
  const transformSubmissionsToProducts = async (submissions: any[]): Promise<DashboardProduct[]> => {
    const productMap = new Map<string, DashboardProduct>();
    
    // Process each submission to extract product information
    for (const submission of submissions) {
      try {
        // Get scan lines for this submission
        const scanLinesResponse = await apiClient.getSubmissionScanLines(submission.id);
        
        if (scanLinesResponse.success && scanLinesResponse.scan_lines) {
          // Group scan lines by product
          const productGroups = new Map<number, any[]>();
          
          for (const scanLine of scanLinesResponse.scan_lines) {
            if (!productGroups.has(scanLine.product_id)) {
              productGroups.set(scanLine.product_id, []);
            }
            productGroups.get(scanLine.product_id)!.push(scanLine);
          }
          
          // Create dashboard products from grouped scan lines
          for (const [productId, scanLines] of productGroups) {
            const firstScanLine = scanLines[0];
            const productKey = `${productId}`;
            
            if (!productMap.has(productKey)) {
              // Calculate totals
              const totalLots = scanLines.length;
              const theoretical = scanLines.reduce((sum, line) => sum + (line.theoretical_qty || 0), 0);
              const scanned = scanLines.reduce((sum, line) => sum + (line.scanned_qty || 0), 0);
              
              // Determine status
              let status: 'pending' | 'partial' | 'complete' = 'pending';
              const scannedLots = scanLines.filter(line => line.scanned_qty > 0).length;
              if (scannedLots === totalLots) {
                status = 'complete';
              } else if (scannedLots > 0) {
                status = 'partial';
              }
              
              productMap.set(productKey, {
                id: productId,
                code: `${productId}`, // Use product ID as code since that's what the API expects
                name: firstScanLine.product_name,
                totalLots,
                theoretical,
                scanned,
                status,
                rack: scanLines[0]?.rack_name || availableRacks[0]?.name || 'Unknown',
                lots: scanLines.map(line => ({
                  id: line.lot_name,
                  theoretical: line.theoretical_qty || 0,
                  scanned: line.scanned_qty || null,
                  expiry: undefined // Not available in current API
                }))
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing submission ${submission.id}:`, error);
      }
    }
    
    return Array.from(productMap.values());
  };

  // Fallback mock data
  const getMockProducts = (): DashboardProduct[] => [
    {
      id: 20328,
      code: '20328',
      name: 'Dermalogika Instant Glow Glowing and Detoxifying Sheet Mask',
      totalLots: 7,
      theoretical: 11,
      scanned: 3,
      status: 'partial',
      rack: availableRacks[0]?.name || 'JFP Rack1',
      lots: [
        { id: '0060028', theoretical: 5, scanned: 5 },
        { id: '0068531', theoretical: 1, scanned: 1 },
        { id: '0072824', theoretical: 1, scanned: 1 },
        { id: '0076546', theoretical: 1, scanned: null },
        { id: '0077091', theoretical: 1, scanned: null },
        { id: '0080189', theoretical: 1, scanned: null },
        { id: '0090039', theoretical: 1, scanned: null }
      ]
    },
    {
      id: 1001,
      code: '1001',
      name: 'Skin Cafe Almond Oil (Cold Pressed)',
      totalLots: 3,
      theoretical: 43,
      scanned: 20,
      status: 'partial',
      rack: availableRacks[0]?.name || 'JFP Rack1',
      lots: [
        { id: '0099986', theoretical: 20, scanned: 20 },
        { id: '0099987', theoretical: 15, scanned: null },
        { id: '0099988', theoretical: 8, scanned: null }
      ]
    },
    {
      id: 22027,
      code: '22027',
      name: 'Panam Care Herbal Glow Facial Kit',
      totalLots: 4,
      theoretical: 43,
      scanned: 0,
      status: 'pending',
      rack: availableRacks[1]?.name || 'JFP Rack2',
      lots: [
        { id: '0099362', theoretical: 8, scanned: null },
        { id: '0099363', theoretical: 12, scanned: null },
        { id: '0099364', theoretical: 5, scanned: null },
        { id: '0099365', theoretical: 18, scanned: null }
      ]
    }
  ];

  // Handle product selection - navigate to scanner with product
  const handleProductSelect = (product: DashboardProduct) => {
    console.log('Dashboard: Selecting product', product);

    // Store the entire product information for the scanner
    const productForScanner = {
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      rack: product.rack,
      lots: product.lots.map(lot => ({
        lot_name: lot.id,
        theoretical_qty: lot.theoretical,
        scanned_qty: lot.scanned || 0,
        expiry_date: lot.expiry || null
      }))
    };

    console.log('Dashboard: Storing product for scanner:', productForScanner);
    localStorage.setItem('selected_product_info', JSON.stringify(productForScanner));

    // Navigate to scanner
    setTimeout(() => {
      navigate('/scanner');
      console.log('Dashboard: Navigation completed');
    }, 0);
  };

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate overall stats
  const totalProducts = products.length;
  const completedProducts = products.filter(p => p.status === 'complete').length;
  const partialProducts = products.filter(p => p.status === 'partial').length;
  const pendingProducts = products.filter(p => p.status === 'pending').length;

  const theme = (isDark: boolean, darkClass: string, lightClass: string) => 
    isDark ? darkClass : lightClass;

  return (
    <div className={`min-h-screen ${theme(isDarkMode, 'bg-gray-900', 'bg-gray-50')}`}>
      {/* Header */}
      <div className={`border-b ${theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')}`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className={`text-lg font-semibold ${theme(isDarkMode, 'text-white', 'text-gray-900')}`}>
                  Inventory Dashboard
                </h1>
                <p className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                  {runningProject?.name || 'Test JFP'} • {runningProject?.location_name || 'JFP/Stock'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/scanner')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  theme(isDarkMode, 'bg-blue-600 hover:bg-blue-500 text-white', 'bg-blue-500 hover:bg-blue-600 text-white')
                }`}
              >
                Scanner
              </button>
              <button
                onClick={logout}
                className={`p-2 rounded-lg transition-colors ${
                  theme(isDarkMode, 'bg-gray-700 hover:bg-gray-600', 'bg-gray-100 hover:bg-gray-200')
                }`}
              >
                <LogOut className={`w-4 h-4 ${theme(isDarkMode, 'text-gray-300', 'text-gray-700')}`} />
              </button>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  theme(isDarkMode, 'bg-gray-700 hover:bg-gray-600', 'bg-gray-100 hover:bg-gray-200')
                }`}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
            Loading submissions data...
          </p>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="p-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${theme(isDarkMode, 'bg-gray-800', 'bg-white')} shadow`}>
              <div className="text-2xl font-bold text-blue-600">{totalProducts}</div>
              <div className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>Total Products</div>
            </div>
            <div className={`p-4 rounded-lg ${theme(isDarkMode, 'bg-gray-800', 'bg-white')} shadow`}>
              <div className="text-2xl font-bold text-green-600">{completedProducts}</div>
              <div className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>Completed</div>
            </div>
            <div className={`p-4 rounded-lg ${theme(isDarkMode, 'bg-gray-800', 'bg-white')} shadow`}>
              <div className="text-2xl font-bold text-yellow-600">{partialProducts}</div>
              <div className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>Partial</div>
            </div>
            <div className={`p-4 rounded-lg ${theme(isDarkMode, 'bg-gray-800', 'bg-white')} shadow`}>
              <div className="text-2xl font-bold text-red-600">{pendingProducts}</div>
              <div className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>Pending</div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme(isDarkMode, 'text-gray-400', 'text-gray-500')}`} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  theme(isDarkMode, 'bg-gray-800 border-gray-700 text-white', 'bg-white border-gray-300 text-gray-900')
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          </div>

          {/* Products List */}
          <div className={`rounded-lg ${theme(isDarkMode, 'bg-gray-800', 'bg-white')} shadow overflow-hidden`}>
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleProductSelect(product)}
                className={`p-4 border-b cursor-pointer hover:bg-opacity-50 transition-colors ${
                  theme(isDarkMode, 'border-gray-700 hover:bg-gray-700', 'border-gray-200 hover:bg-gray-50')
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-sm font-mono px-2 py-1 rounded ${
                        theme(isDarkMode, 'bg-gray-700 text-gray-300', 'bg-gray-100 text-gray-700')
                      }`}>
                        {product.code}
                      </span>
                      <div className="flex items-center gap-1">
                        {product.status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {product.status === 'partial' && <Clock className="w-4 h-4 text-yellow-500" />}
                        {product.status === 'pending' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <span className={`text-xs capitalize ${
                          product.status === 'complete' ? 'text-green-500' :
                          product.status === 'partial' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {product.status}
                        </span>
                      </div>
                    </div>
                    <h3 className={`font-medium ${theme(isDarkMode, 'text-white', 'text-gray-900')}`}>
                      {product.name}
                    </h3>
                    <div className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')} mt-1`}>
                      {product.totalLots} lots • {product.scanned}/{product.theoretical} units • {product.rack}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${theme(isDarkMode, 'text-white', 'text-gray-900')}`}>
                      {Math.round((product.scanned / product.theoretical) * 100)}%
                    </div>
                    <div className={`text-xs ${theme(isDarkMode, 'text-gray-400', 'text-gray-500')}`}>
                      Complete
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className={`text-center py-12 ${theme(isDarkMode, 'text-gray-400', 'text-gray-500')}`}>
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No products found</p>
                <p>Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
