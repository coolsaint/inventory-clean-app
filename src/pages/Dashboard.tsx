import React, { useState } from 'react';
import { Search, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [isDesktop, setIsDesktop] = useState(false);
  const navigate = useNavigate();

  // Check screen size
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Mock product data with some pre-scanned lots
  const products = [
    {
      id: 1,
      code: '22027',
      name: 'Panam Care Herbal Glow Facial Kit',
      totalLots: 4,
      theoretical: 43,
      status: 'partial',
      rack: 'A-15',
      lots: [
        { id: '0099362', theoretical: 8, scanned: 8, expiry: '2025-03-15' },
        { id: '0099363', theoretical: 12, scanned: 11, expiry: '2025-04-20' },
        { id: '0099364', theoretical: 5, scanned: null, expiry: '2025-05-10' },
        { id: '0099365', theoretical: 18, scanned: null, expiry: '2025-06-05' }
      ]
    },
    {
      id: 2,
      code: '20328',
      name: 'Dermalogika Sheet Mask',
      totalLots: 2,
      theoretical: 25,
      status: 'complete',
      rack: 'B-08',
      lots: [
        { id: '0088451', theoretical: 15, scanned: 15, expiry: '2025-02-28' },
        { id: '0088452', theoretical: 10, scanned: 10, expiry: '2025-03-15' }
      ]
    },
    {
      id: 3,
      code: '21022',
      name: 'Nirvana Glitter Nail Enamel',
      totalLots: 6,
      theoretical: 72,
      status: 'partial',
      rack: 'C-22',
      lots: [
        { id: '0077341', theoretical: 12, scanned: 13, expiry: '2025-01-30' },
        { id: '0077342', theoretical: 8, scanned: 6, expiry: '2025-02-15' },
        { id: '0077343', theoretical: 15, scanned: 15, expiry: '2025-03-20' },
        { id: '0077344', theoretical: 10, scanned: null, expiry: '2025-04-10' },
        { id: '0077345', theoretical: 14, scanned: null, expiry: '2025-05-25' },
        { id: '0077346', theoretical: 13, scanned: null, expiry: '2025-06-30' }
      ]
    },
    {
      id: 4,
      code: '19856',
      name: 'Lakme Absolute Perfect Radiance Foundation',
      totalLots: 3,
      theoretical: 36,
      status: 'pending',
      rack: 'D-12',
      lots: [
        { id: '0066234', theoretical: 12, scanned: null, expiry: '2025-08-15' },
        { id: '0066235', theoretical: 15, scanned: null, expiry: '2025-09-20' },
        { id: '0066236', theoretical: 9, scanned: null, expiry: '2025-10-10' }
      ]
    },
    {
      id: 5,
      code: '23145',
      name: 'Himalaya Purifying Face Wash',
      totalLots: 5,
      theoretical: 85,
      status: 'partial',
      rack: 'E-07',
      lots: [
        { id: '0055123', theoretical: 20, scanned: 22, expiry: '2025-12-31' },
        { id: '0055124', theoretical: 18, scanned: 18, expiry: '2026-01-15' },
        { id: '0055125', theoretical: 15, scanned: 14, expiry: '2026-02-28' },
        { id: '0055126', theoretical: 17, scanned: null, expiry: '2026-03-20' },
        { id: '0055127', theoretical: 15, scanned: null, expiry: '2026-04-10' }
      ]
    }
  ];

  // Dashboard helper functions
  const getProductStats = (product: any) => {
    const scannedLots = product.lots.filter((lot: any) => lot.scanned !== null);
    const totalScanned = product.lots.reduce((sum: number, lot: any) => sum + (lot.scanned || 0), 0);
    const totalTheoretical = product.lots.reduce((sum: number, lot: any) => sum + lot.theoretical, 0);
    const variance = totalScanned - totalTheoretical;
    const completionRate = Math.round((scannedLots.length / product.lots.length) * 100);
    
    return {
      scannedLots: scannedLots.length,
      totalLots: product.lots.length,
      totalScanned,
      totalTheoretical,
      variance,
      completionRate
    };
  };

  const getOverallStats = () => {
    const allProducts = products;
    const totalProducts = allProducts.length;
    const completedProducts = allProducts.filter(p => p.status === 'complete').length;
    const partialProducts = allProducts.filter(p => p.status === 'partial').length;
    const pendingProducts = allProducts.filter(p => p.status === 'pending').length;
    
    return { totalProducts, completedProducts, partialProducts, pendingProducts };
  };

  // Filter and search logic
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (dashboardFilter === 'all') return matchesSearch;
    return matchesSearch && product.status === dashboardFilter;
  });

  // Sorting logic
  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleProductSelect = (product: any) => {
    // Navigate to scanner with product context
    navigate('/scanner', { state: { selectedProduct: product } });
  };

  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];
    
    if (sortConfig.key === 'theoretical') {
      aValue = a.theoretical;
      bValue = b.theoretical;
    } else if (sortConfig.key === 'completion') {
      aValue = getProductStats(a).completionRate;
      bValue = getProductStats(b).completionRate;
    } else if (sortConfig.key === 'variance') {
      aValue = getProductStats(a).variance;
      bValue = getProductStats(b).variance;
    }
    
    if (sortConfig.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const overallStats = getOverallStats();

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-600" />
              <h1 className="text-lg font-semibold">Inventory Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/scanner')}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Open Scanner
              </button>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Total Products</span>
            </div>
            <div className="text-2xl font-bold mt-1">{overallStats.totalProducts}</div>
          </div>
          
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">{overallStats.completedProducts}</div>
          </div>
          
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium">Partial</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-yellow-600">{overallStats.partialProducts}</div>
          </div>
          
          <div className={`p-3 rounded-lg border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">{overallStats.pendingProducts}</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>
          
          <select
            value={dashboardFilter}
            onChange={(e) => setDashboardFilter(e.target.value)}
            className={`px-4 py-2.5 rounded-lg border transition-colors ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
          >
            <option value="all">All Status</option>
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Products Table */}
        <div className={`rounded-lg border overflow-hidden ${
          isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    <button onClick={() => handleSort('code')} className="flex items-center gap-1 hover:text-blue-600">
                      Code
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-blue-600">
                      Product Name
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    <button onClick={() => handleSort('theoretical')} className="flex items-center gap-1 hover:text-blue-600">
                      Theoretical
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    <button onClick={() => handleSort('completion')} className="flex items-center gap-1 hover:text-blue-600">
                      Progress
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    <button onClick={() => handleSort('variance')} className="flex items-center gap-1 hover:text-blue-600">
                      Variance
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {paginatedProducts.map((product) => {
                  const stats = getProductStats(product);
                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-opacity-50 cursor-pointer transition-colors ${
                        isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleProductSelect(product)}
                    >
                      <td className="px-4 py-3 text-sm font-mono">{product.code}</td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-sm">{product.name}</div>
                          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            Rack: {product.rack}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{stats.totalTheoretical}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-16 h-2 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                stats.completionRate === 100 ? 'bg-green-500' :
                                stats.completionRate > 0 ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${stats.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">
                            {stats.completionRate}%
                          </span>
                          {!isDesktop && (
                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              ({stats.scannedLots}/{stats.totalLots})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 font-medium ${
                        stats.variance === 0 ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                        stats.variance > 0 ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') :
                        (isDarkMode ? 'text-red-400' : 'text-red-600')
                      }`}>
                        {stats.variance > 0 ? '+' : ''}{stats.variance}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductSelect(product);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Scan Lots
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={`border-t p-3 flex items-center justify-between text-xs ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedProducts.length)} of {sortedProducts.length} products
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-2 py-1 rounded transition-colors ${
                    currentPage === 1 ? 
                      (isDarkMode ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') :
                      (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                  }`}
                >
                  Previous
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2 py-1 rounded transition-colors ${
                          currentPage === pageNum ? 
                            (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700') :
                            (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-2 py-1 rounded transition-colors ${
                    currentPage === totalPages ? 
                      (isDarkMode ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') :
                      (isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {sortedProducts.length === 0 && (
            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No products found</p>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
