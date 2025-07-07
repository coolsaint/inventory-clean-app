import React, { useState } from 'react';
import { Search, Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function InventoryDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [isDesktop, setIsDesktop] = useState(false);

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
  const getProductStats = (product) => {
    const scannedLots = product.lots.filter(lot => lot.scanned !== null);
    const totalScanned = product.lots.reduce((sum, lot) => sum + (lot.scanned || 0), 0);
    const totalTheoretical = product.lots.reduce((sum, lot) => sum + lot.theoretical, 0);
    const variance = totalScanned - totalTheoretical;
    const completionRate = Math.round((scannedLots.length / product.lots.length) * 100);
    
    return {
      scannedLots: scannedLots.length,
      totalLots: product.lots.length,
      totalScanned,
      totalTheoretical,
      variance,
      completionRate,
      status: scannedLots.length === product.lots.length ? 'complete' : 
               scannedLots.length > 0 ? 'partial' : 'pending'
    };
  };

  const getOverallStats = () => {
    const allStats = products.map(getProductStats);
    return {
      totalProducts: products.length,
      completedProducts: allStats.filter(s => s.status === 'complete').length,
      partialProducts: allStats.filter(s => s.status === 'partial').length,
      pendingProducts: allStats.filter(s => s.status === 'pending').length,
      totalVariance: allStats.reduce((sum, s) => sum + s.variance, 0),
      avgCompletion: Math.round(allStats.reduce((sum, s) => sum + s.completionRate, 0) / products.length)
    };
  };

  const filteredDashboardProducts = products.filter(product => {
    const stats = getProductStats(product);
    if (dashboardFilter === 'all') return true;
    return stats.status === dashboardFilter;
  }).filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.includes(searchQuery)
  );

  // Sorting and pagination
  const sortedProducts = [...filteredDashboardProducts].sort((a, b) => {
    const aStats = getProductStats(a);
    const bStats = getProductStats(b);
    
    let aValue, bValue;
    switch (sortConfig.key) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'completion':
        aValue = aStats.completionRate;
        bValue = bStats.completionRate;
        break;
      case 'variance':
        aValue = aStats.variance;
        bValue = bStats.variance;
        break;
      default:
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
    }
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleProductSelect = (product) => {
    // In the full app, this would navigate to scanning view
    console.log('Selected product:', product);
  };

  return (
    <div className={`${isDesktop ? 'max-w-6xl' : 'max-w-full'} mx-auto min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Dark Mode Toggle */}
      <div className="fixed top-2 right-2 z-50">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-2 rounded-lg transition-all duration-300 ${
            isDarkMode 
              ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' 
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Dashboard Header */}
      <div className={`shadow-sm p-4 border-b transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex justify-between items-center mb-4">
          <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Inventory Dashboard
          </h1>
          <button
            onClick={() => console.log('Start scanning')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-300 ${
              isDarkMode 
                ? 'bg-blue-600 text-white hover:bg-blue-500' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Start Scanning
          </button>
        </div>

        {/* Overall Stats */}
        <div className={`grid ${isDesktop ? 'grid-cols-8' : 'grid-cols-4'} gap-2 mb-4`}>
          {(() => {
            const stats = getOverallStats();
            return (
              <>
                <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                  isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {stats.totalProducts}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total
                  </div>
                </div>
                <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                  isDarkMode ? 'bg-gray-800 border-green-600' : 'bg-white border-green-200'
                }`}>
                  <div className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {stats.completedProducts}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Done
                  </div>
                </div>
                <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                  isDarkMode ? 'bg-gray-800 border-yellow-600' : 'bg-white border-yellow-200'
                }`}>
                  <div className={`text-lg font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    {stats.partialProducts}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Partial
                  </div>
                </div>
                <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                  isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  <div className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {stats.pendingProducts}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Pending
                  </div>
                </div>
                {isDesktop && (
                  <>
                    <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                      stats.totalVariance === 0 ? 
                        (isDarkMode ? 'bg-gray-800 border-green-600' : 'bg-white border-green-200') : 
                        stats.totalVariance > 0 ? 
                        (isDarkMode ? 'bg-gray-800 border-blue-600' : 'bg-white border-blue-200') : 
                        (isDarkMode ? 'bg-gray-800 border-red-600' : 'bg-white border-red-200')
                    }`}>
                      <div className={`text-lg font-bold ${
                        stats.totalVariance === 0 ? 
                          (isDarkMode ? 'text-green-400' : 'text-green-600') : 
                          stats.totalVariance > 0 ? 
                          (isDarkMode ? 'text-blue-400' : 'text-blue-600') : 
                          (isDarkMode ? 'text-red-400' : 'text-red-600')
                      }`}>
                        {stats.totalVariance > 0 ? '+' : ''}{stats.totalVariance}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Variance
                      </div>
                    </div>
                    <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                    }`}>
                      <div className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {stats.avgCompletion}%
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Avg
                      </div>
                    </div>
                    <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                    }`}>
                      <div className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {sortedProducts.length}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Filtered
                      </div>
                    </div>
                    <div className={`p-2 rounded border text-center transition-colors duration-300 ${
                      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                    }`}>
                      <div className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {currentPage}/{totalPages}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Page
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* Search and Filters */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className={`w-full pl-9 pr-4 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            <div className={`px-3 py-2 text-xs rounded flex items-center gap-2 ${
              isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
            }`}>
              <span>💡 Click row to scan</span>
            </div>
            {isDesktop && (
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={`px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {['all', 'pending', 'partial', 'complete'].map(filter => (
              <button
                key={filter}
                onClick={() => {
                  setDashboardFilter(filter);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs rounded border whitespace-nowrap transition-colors duration-300 ${
                  dashboardFilter === filter ? 
                    (isDarkMode ? 'border-gray-500 bg-gray-700 text-white' : 'border-gray-400 bg-gray-100 text-gray-900') :
                    (isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50')
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)} 
                ({getOverallStats()[filter === 'all' ? 'totalProducts' : `${filter}Products`]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard Content - Table */}
      <div className={`overflow-hidden transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={`border-b-2 sticky top-0 z-10 ${
              isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
            }`}>
              <tr>
                {[
                  { key: 'name', label: 'Product', width: isDesktop ? 'w-64' : 'w-48' },
                  { key: 'completion', label: 'Progress', width: isDesktop ? 'w-32' : 'w-24' },
                  { key: 'variance', label: 'Var', width: 'w-16' },
                ].map(col => (
                  <th
                    key={col.key}
                    className={`${col.width} px-2 py-2 text-left font-medium cursor-pointer hover:bg-opacity-50 transition-colors ${
                      isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map(product => {
                const stats = getProductStats(product);
                
                return (
                  <tr 
                    key={product.id}
                    className={`border-b hover:bg-opacity-50 transition-colors cursor-pointer ${
                      isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                    onClick={() => handleProductSelect(product)}
                  >
                    <td className={`px-2 py-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          [{product.code}]
                        </span>
                        <span className={`truncate ${isDesktop ? 'max-w-48' : 'max-w-32'}`} title={product.name}>
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`${isDesktop ? 'w-16' : 'w-12'} h-2 rounded-full overflow-hidden ${
                          isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                        }`}>
                          <div 
                            className={`h-full transition-all duration-300 ${
                              stats.status === 'complete' ? 
                                (isDarkMode ? 'bg-gray-400' : 'bg-gray-600') :
                              stats.status === 'partial' ? 
                                (isDarkMode ? 'bg-gray-500' : 'bg-gray-500') :
                                (isDarkMode ? 'bg-gray-600' : 'bg-gray-400')
                            }`}
                            style={{ width: `${stats.completionRate}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {stats.completionRate}%
                        </span>
                        {isDesktop && (
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            ({stats.scannedLots}/{stats.totalLots})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-2 py-2 font-medium ${
                      stats.variance === 0 ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                      stats.variance > 0 ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') :
                      (isDarkMode ? 'text-red-400' : 'text-red-600')
                    }`}>
                      {stats.variance > 0 ? '+' : ''}{stats.variance}
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
  );
}