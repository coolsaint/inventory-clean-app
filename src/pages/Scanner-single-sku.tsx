import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Package, CheckCircle, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient, isOnline } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

// Theme utility
const theme = (isDark: boolean, darkClass: string, lightClass: string) => 
  isDark ? darkClass : lightClass;

// Product and lot interfaces
interface ProductLot {
  lot_id: number;
  lot_name: string;
  theoretical_qty: number;
  expiry_date?: string;
}

interface ProductInfo {
  product_id: number;
  product_name: string;
  product_code: string;
  rack?: string;
  lots: ProductLot[];
}

// Custom hook for single SKU scanner logic
const useSingleSkuScanner = () => {
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [scannedLots, setScannedLots] = useState<{[key: string]: number}>({});
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{lotId: string, time: number} | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(isOnline());

  
  const { runningProject, availableRacks } = useAuthStore();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus(true);
    const handleOffline = () => setNetworkStatus(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const totalScanned = Object.values(scannedLots).reduce((sum, count) => sum + count, 0);
  const totalTheoretical = productInfo?.lots.reduce((sum, lot) => sum + lot.theoretical_qty, 0) || 0;
  const variance = totalScanned - totalTheoretical;
  
  const isRecentlyScanned = (lotId: string) => 
    lastScanned?.lotId === lotId && Date.now() - lastScanned.time < 3000;

  // Load product info for a specific SKU
  const loadProductInfo = async (productCode: string) => {
    if (!runningProject) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.getProductLots(productCode, runningProject.location_id);

      if (response.success && response.product_info) {
        const productInfo: ProductInfo = {
          product_id: response.product_info.product_id,
          product_name: response.product_info.product_name,
          product_code: response.product_info.product_code,
          rack: availableRacks[0]?.name || "Unknown", // Use first available rack
          lots: response.product_info.lots
        };

        setProductInfo(productInfo);
      } else {
        setError(response.error || 'Product not found');
      }
    } catch (err: any) {
      setError('Failed to load product information');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle lot scanning (product should already be loaded from dashboard)
  const handleScan = async (input: string) => {
    if (!runningProject) return;

    // If no product is loaded, try to load product by lot name (for dashboard navigation)
    if (!productInfo) {
      console.log('Scanner: No product loaded, trying to load product by lot:', input);
      setScanInput('');
      setError('');
      setIsLoading(true);

      try {
        const response = await apiClient.findProductByLot(input, runningProject.location_id);

        if (response.success && response.product_info) {
          const productInfo: ProductInfo = {
            product_id: response.product_info.product_id,
            product_name: response.product_info.product_name,
            product_code: response.product_info.product_code,
            rack: availableRacks[0]?.name || "Unknown",
            lots: response.product_info.lots
          };

          console.log('Scanner: Product loaded successfully:', productInfo);
          setProductInfo(productInfo);
          setError('');
        } else {
          console.error('Scanner: Failed to load product by lot:', input, response);
          setError(`Lot "${input}" not found. Please try a different lot number.`);
          setTimeout(() => setError(''), 4000);
        }
      } catch (err: any) {
        console.error('Scanner: Error loading product by lot:', err);
        setError('Network error during product lookup');
        setTimeout(() => setError(''), 3000);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const lotNumber = input;
    setScanInput('');
    setError('');
    setIsLoading(true);

    try {
      // Check if lot exists in current product
      const lot = productInfo.lots.find(l => l.lot_name === lotNumber);
      if (!lot) {
        setError(`Lot ${lotNumber} not found in current product`);
        setTimeout(() => setError(''), 3000);
        setIsLoading(false);
        return;
      }

      // Verify lot exists in database
      const response = await apiClient.getLotInfo(lotNumber, runningProject.location_id);

      if (response.success && response.data && response.data.length > 0) {
        // Add to scanned lots
        setScannedLots(prev => ({
          ...prev,
          [lotNumber]: (prev[lotNumber] || 0) + 1
        }));
        setLastScanned({ lotId: lotNumber, time: Date.now() });
      } else {
        setError(`Lot ${lotNumber} not found in database`);
        setTimeout(() => setError(''), 3000);
      }
    } catch (err: any) {
      setError('Network error during scan');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!productInfo || !runningProject || Object.keys(scannedLots).length === 0) return;

    setIsLoading(true);
    try {
      const scanLines = Object.entries(scannedLots).map(([lotName, scannedQty]) => ({
        lot_name: lotName,
        scanned_qty: scannedQty,
        notes: `Scanned ${scannedQty} units`
      }));

      const response = await apiClient.createSubmission({
        api_token: '', // Will be added by interceptor
        project_id: runningProject.id,
        rack_id: availableRacks[0]?.id,
        scan_lines: scanLines
      });

      if (response.success) {
        // Reset scanner for next product
        setScannedLots({});
        setLastScanned(null);
        alert(`Submission successful! Reference: ${response.submission_reference}`);
      } else {
        setError(response.error || 'Submission failed');
      }
    } catch (err: any) {
      setError('Network error during submission');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to product selection mode
  const resetProduct = () => {
    setProductInfo(null);
    setScannedLots({});
    setLastScanned(null);
    setError('');
  };

  // Check for pre-selected product from dashboard
  useEffect(() => {
    const selectedProductInfo = localStorage.getItem('selected_product_info');
    console.log('Scanner: Checking for pre-selected product:', selectedProductInfo);

    if (selectedProductInfo && runningProject && !productInfo) {
      try {
        const productData = JSON.parse(selectedProductInfo);
        console.log('Scanner: Loading pre-selected product:', productData);

        // Clear the stored product info
        localStorage.removeItem('selected_product_info');

        // Convert to ProductInfo format
        const productInfo: ProductInfo = {
          product_id: productData.product_id,
          product_name: productData.product_name,
          product_code: productData.product_code,
          rack: productData.rack || availableRacks[0]?.name || "Unknown",
          lots: productData.lots
        };

        console.log('Scanner: Setting product info:', productInfo);
        setProductInfo(productInfo);
        setError('');
      } catch (error) {
        console.error('Scanner: Error parsing selected product info:', error);
        localStorage.removeItem('selected_product_info');
      }
    }
  }, [runningProject, productInfo]);



  return {
    productInfo,
    scannedLots,
    scanInput,
    setScanInput,
    lastScanned,
    error,
    isLoading,
    networkStatus,
    totalScanned,
    totalTheoretical,
    variance,
    isRecentlyScanned,
    handleScan,
    handleSubmit,
    loadProductInfo,
    resetProduct,
    runningProject
  };
};

export default function SingleSkuScanner() {
  console.log('Scanner: Component loading/rendering');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  
  const {
    productInfo,
    scannedLots,
    scanInput,
    setScanInput,
    error,
    isLoading,
    networkStatus,
    totalScanned,
    totalTheoretical,
    variance,
    isRecentlyScanned,
    handleScan,
    handleSubmit,
    resetProduct,
    runningProject
  } = useSingleSkuScanner();

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // If no product is loaded, show a simple message to go back to dashboard
  if (!productInfo) {
    return (
      <div className={`min-h-screen transition-colors ${
        theme(isDarkMode, 'bg-gray-900 text-white', 'bg-gray-50 text-gray-900')
      }`}>
        {/* Header */}
        <div className={`border-b ${theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')}`}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('/dashboard')}>
                  <ArrowLeft className={`w-5 h-5 ${theme(isDarkMode, 'text-gray-300', 'text-gray-700')}`} />
                </button>
                <div>
                  <h1 className="text-lg font-semibold">Scanner</h1>
                  <p className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                    {runningProject?.name || 'Test JFP'} • {runningProject?.location_name || 'JFP/Stock'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!networkStatus && (
                  <WifiOff className={`w-5 h-5 ${theme(isDarkMode, 'text-red-400', 'text-red-500')}`} />
                )}
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

        {/* Content */}
        <div className="p-4">
          <div className={`p-8 rounded-lg text-center ${theme(isDarkMode, 'bg-gray-800', 'bg-gray-100')}`}>
            <Package className={`w-16 h-16 mx-auto mb-4 opacity-50 ${theme(isDarkMode, 'text-gray-400', 'text-gray-500')}`} />
            <h3 className={`font-medium mb-2 ${theme(isDarkMode, 'text-white', 'text-gray-900')}`}>No Product Selected</h3>
            <p className={`text-sm mb-4 ${theme(isDarkMode, 'text-gray-300', 'text-gray-600')}`}>
              Please select a product from the dashboard to start scanning.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Computed values
  const getVarianceColor = () => {
    if (variance === 0) return theme(isDarkMode, 'text-green-400', 'text-green-600');
    return variance > 0 
      ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
      : theme(isDarkMode, 'text-red-400', 'text-red-600');
  };

  const sortedLots = productInfo.lots.sort((a, b) => {
    const aScanned = scannedLots[a.lot_name] > 0;
    const bScanned = scannedLots[b.lot_name] > 0;
    if (aScanned !== bScanned) return bScanned ? 1 : -1;
    return isRecentlyScanned(b.lot_name) ? 1 : -1;
  });

  const stats = [
    { label: 'Expected', value: totalTheoretical, color: theme(isDarkMode, 'text-gray-300', 'text-gray-700') },
    { label: 'Scanned', value: totalScanned, color: theme(isDarkMode, 'text-blue-400', 'text-blue-600') },
    { label: 'Variance', value: variance > 0 ? `+${variance}` : variance || '-', color: getVarianceColor() }
  ];

  const LotItem = ({ lot }: { lot: ProductLot }) => {
    const scannedCount = scannedLots[lot.lot_name] || 0;
    const lotVariance = scannedCount - lot.theoretical_qty;
    const isScanned = scannedCount > 0;
    const isRecent = isRecentlyScanned(lot.lot_name);

    return (
      <div className={`flex justify-between items-center p-3 rounded-lg transition-all duration-500 ${
        isRecent 
          ? theme(isDarkMode, 'bg-green-800 border-2 border-green-400 scale-105', 'bg-green-100 border-2 border-green-400 scale-105')
          : isScanned 
            ? theme(isDarkMode, 'border-green-600 bg-green-900/20', 'border-green-200 bg-green-50')
            : theme(isDarkMode, 'border-gray-600 bg-gray-700', 'border-gray-200 bg-gray-50')
      } border`}>
        <div>
          <div className="flex items-center gap-3">
            {isScanned ? (
              <CheckCircle className={`w-5 h-5 ${isRecent ? 'animate-pulse' : ''} ${
                theme(isDarkMode, 'text-green-400', 'text-green-600')
              }`} />
            ) : (
              <div className={`w-5 h-5 border-2 rounded-full ${
                theme(isDarkMode, 'border-gray-400', 'border-gray-300')
              }`} />
            )}
            <div className={`font-mono font-bold ${
              theme(isDarkMode, 'text-gray-100', 'text-gray-900')
            }`}>
              {lot.lot_name}
            </div>
          </div>
          {lot.expiry_date && (
            <div className={`text-xs mt-1 ml-8 ${
              theme(isDarkMode, 'text-gray-400', 'text-gray-500')
            }`}>
              Exp: {lot.expiry_date}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={`font-bold ${
            theme(isDarkMode, 'text-gray-100', 'text-gray-900')
          }`}>
            {scannedCount} / {lot.theoretical_qty}
          </div>
          {lotVariance !== 0 && (
            <div className={`text-xs ${
              lotVariance > 0 
                ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
                : theme(isDarkMode, 'text-red-400', 'text-red-600')
            }`}>
              {lotVariance > 0 ? '+' : ''}{lotVariance}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors ${
      theme(isDarkMode, 'bg-gray-900 text-white', 'bg-gray-50 text-gray-900')
    }`}>
      {/* Header with Product Info */}
      <div className={`border-b ${theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')}`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className={`w-5 h-5 ${theme(isDarkMode, 'text-gray-300', 'text-gray-700')}`} />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{productInfo.product_name}</h1>
                <p className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                  [{productInfo.product_code}] • Rack: {productInfo.rack}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!networkStatus && (
                <WifiOff className={`w-5 h-5 ${theme(isDarkMode, 'text-red-400', 'text-red-500')}`} />
              )}
              <button
                onClick={resetProduct}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  theme(isDarkMode, 'bg-blue-600 hover:bg-blue-500 text-white', 'bg-blue-500 hover:bg-blue-600 text-white')
                }`}
              >
                Change Product
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className={`text-xs ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scanner Input */}
      <div className="p-4">
        <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row'}`}>
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && scanInput.trim() && handleScan(scanInput.trim())}
            placeholder="Scan or enter lot number..."
            disabled={isLoading}
            className={`${isMobile ? 'w-full' : 'flex-1'} px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono transition-all ${
              theme(isDarkMode, 
                'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400', 
                'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500'
              )
            } ${error ? 'border-red-500 animate-pulse' : ''}`}
            autoFocus
          />
          {totalScanned > 0 && (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`${isMobile ? 'w-full' : 'px-4'} py-2 rounded-lg font-medium flex items-center ${
                isMobile ? 'justify-center' : ''
              } gap-2 transition-colors ${
                theme(isDarkMode, 'bg-green-600 hover:bg-green-500', 'bg-green-600 hover:bg-green-700')
              } text-white disabled:opacity-50`}
            >
              <Send className="w-4 h-4" />
              Submit ({totalScanned})
            </button>
          )}
        </div>

        {error && (
          <div className={`mt-2 p-2 rounded text-sm ${
            theme(isDarkMode, 'bg-red-900 text-red-200', 'bg-red-100 text-red-700')
          }`}>
            {error}
          </div>
        )}
      </div>

      {/* Lots List */}
      <div className="px-4 pb-4">
        <div className="space-y-2">
          {sortedLots.map((lot) => (
            <LotItem key={lot.lot_name} lot={lot} />
          ))}
        </div>
      </div>
    </div>
  );
}
