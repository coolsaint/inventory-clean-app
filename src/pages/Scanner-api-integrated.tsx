import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Package, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiClient, isOnline, waitForOnline } from '../lib/api';
import { offlineStorage, type PendingSubmission } from '../lib/offline-storage';
import { useAuthStore } from '../stores/auth-store';

// Theme utility to eliminate repetitive ternary operations
const theme = (isDark: boolean, darkClass: string, lightClass: string) => 
  isDark ? darkClass : lightClass;

// Lot data interface for scanned lots
interface ScannedLot {
  lotId: number;
  lotName: string;
  productId: number;
  productName: string;
  theoreticalQty: number;
  scannedQty: number;
  expiry?: string;
  lastScanned?: number;
}

// Custom hook for scanner logic with real API integration
const useScanner = () => {
  const [scannedLots, setScannedLots] = useState<{[key: string]: ScannedLot}>({});
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{lotId: string, time: number} | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<number | null>(null);
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

  const totalScanned = Object.values(scannedLots).reduce((sum, lot) => sum + lot.scannedQty, 0);
  const totalTheoretical = Object.values(scannedLots).reduce((sum, lot) => sum + lot.theoreticalQty, 0);
  const variance = totalScanned - totalTheoretical;
  
  const isRecentlyScanned = (lotName: string) => 
    lastScanned?.lotId === lotName && Date.now() - lastScanned.time < 3000;

  const handleScan = async (lotNumber: string) => {
    if (!runningProject) {
      setError('No active project found');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsLoading(true);
    setScanInput('');

    try {
      // Check cache first for offline support
      let lotInfo = await offlineStorage.getCachedLotInfo(lotNumber);
      
      if (!lotInfo && networkStatus) {
        // Fetch from API if online and not cached
        const response = await apiClient.getLotInfo(lotNumber, runningProject.location_id);
        
        if (response.success && response.data && response.data.length > 0) {
          const lotData = response.data[0];
          
          // Cache the response
          await offlineStorage.cacheLotInfo({
            lotName: lotNumber,
            locationId: runningProject.location_id,
            data: lotData,
            cachedAt: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour cache
          });
          
          lotInfo = {
            lotName: lotNumber,
            locationId: runningProject.location_id,
            data: lotData,
            cachedAt: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000)
          };
        } else {
          setError(response.error || `Lot ${lotNumber} not found`);
          setTimeout(() => setError(''), 3000);
          setIsLoading(false);
          return;
        }
      } else if (!lotInfo && !networkStatus) {
        setError('Lot not found in cache. Connect to internet to validate new lots.');
        setTimeout(() => setError(''), 3000);
        setIsLoading(false);
        return;
      }

      if (lotInfo) {
        const lotData = lotInfo.data;
        const existingLot = scannedLots[lotNumber];
        
        const updatedLot: ScannedLot = {
          lotId: lotData.lot_id,
          lotName: lotNumber,
          productId: lotData.product_id,
          productName: lotData.product_name || `Product ${lotData.product_id}`,
          theoreticalQty: lotData.lot_stock || 0,
          scannedQty: (existingLot?.scannedQty || 0) + 1,
          lastScanned: Date.now()
        };

        setScannedLots(prev => ({
          ...prev,
          [lotNumber]: updatedLot
        }));
        
        setLastScanned({ lotId: lotNumber, time: Date.now() });

        // Check for previous submissions (re-inventory detection)
        if (networkStatus) {
          try {
            const previousSubmissions = await apiClient.checkPreviousSubmissions(lotNumber, runningProject.id);
            if (previousSubmissions.success && previousSubmissions.submissions && previousSubmissions.submissions.length > 0) {
              // TODO: Show re-inventory modal/notification
              console.log('Previous submissions found for lot:', lotNumber, previousSubmissions.submissions);
            }
          } catch (error) {
            console.error('Error checking previous submissions:', error);
          }
        }
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      setError(error.message || 'Failed to process scan');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScanInput(value);
    if (value.length === 7 && /^\d{7}$/.test(value)) {
      handleScan(value);
    }
  };

  const handleSubmit = async () => {
    if (!runningProject || Object.keys(scannedLots).length === 0) {
      setError('No lots to submit');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsLoading(true);

    try {
      const scanLines = Object.values(scannedLots).map(lot => ({
        lot_name: lot.lotName,
        lot_id: lot.lotId,
        scanned_qty: lot.scannedQty
      }));

      if (networkStatus) {
        // Submit online
        if (currentSubmissionId) {
          // Update existing submission
          const response = await apiClient.updateSubmission({
            api_token: '', // Will be added by interceptor
            submission_id: currentSubmissionId,
            scan_lines_to_add: scanLines
          });

          if (response.success) {
            alert('Submission updated successfully!');
            setScannedLots({});
            setCurrentSubmissionId(null);
          } else {
            throw new Error(response.error || 'Failed to update submission');
          }
        } else {
          // Create new submission
          const response = await apiClient.createSubmission({
            api_token: '', // Will be added by interceptor
            project_id: runningProject.id,
            rack_id: availableRacks[0]?.id,
            scan_lines: scanLines
          });

          if (response.success) {
            alert(`Submission created successfully! ID: ${response.submission_id}`);
            setScannedLots({});
            setCurrentSubmissionId(response.submission_id || null);
          } else {
            throw new Error(response.error || 'Failed to create submission');
          }
        }
      } else {
        // Save for offline sync
        const pendingSubmission: PendingSubmission = {
          id: `pending_${Date.now()}`,
          projectId: runningProject.id,
          rackId: availableRacks[0]?.id,
          scanLines: Object.values(scannedLots).map(lot => ({
            lotName: lot.lotName,
            scannedQty: lot.scannedQty,
            timestamp: lot.lastScanned || Date.now()
          })),
          createdAt: Date.now()
        };

        await offlineStorage.savePendingSubmission(pendingSubmission);
        alert('Submission saved offline. Will sync when connection is restored.');
        setScannedLots({});
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Failed to submit');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    scannedLots,
    scanInput,
    error,
    isLoading,
    networkStatus,
    totalScanned,
    totalTheoretical,
    variance,
    currentSubmissionId,
    isRecentlyScanned,
    handleScan,
    handleInputChange,
    handleSubmit,
    setCurrentSubmissionId
  };
};

export default function Scanner() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, runningProject } = useAuthStore();
  
  // Use custom scanner hook
  const {
    scannedLots,
    scanInput,
    error,
    isLoading,
    networkStatus,
    totalScanned,
    totalTheoretical,
    variance,
    isRecentlyScanned,
    handleScan,
    handleInputChange,
    handleSubmit
  } = useScanner();

  // Screen size detection
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Computed values
  const getVarianceColor = () => {
    if (variance === 0) return theme(isDarkMode, 'text-green-400', 'text-green-600');
    return variance > 0 
      ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
      : theme(isDarkMode, 'text-red-400', 'text-red-600');
  };

  const sortedLots = Object.values(scannedLots).sort((a, b) => {
    if (isRecentlyScanned(b.lotName) !== isRecentlyScanned(a.lotName)) {
      return isRecentlyScanned(b.lotName) ? 1 : -1;
    }
    return (b.lastScanned || 0) - (a.lastScanned || 0);
  });

  const stats = [
    { label: 'Expected', value: totalTheoretical, color: theme(isDarkMode, 'text-gray-300', 'text-gray-700') },
    { label: 'Scanned', value: totalScanned, color: theme(isDarkMode, 'text-blue-400', 'text-blue-600') },
    { label: 'Variance', value: variance > 0 ? `+${variance}` : variance || '-', color: getVarianceColor() }
  ];

  if (!runningProject) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme(isDarkMode, 'bg-gray-900', 'bg-gray-50')
      }`}>
        <div className={`text-center ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
          <Package className="w-16 h-16 mx-auto mb-4" />
          <p>No active project found. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      theme(isDarkMode, 'bg-gray-900 text-white', 'bg-gray-50 text-gray-900')
    }`}>
      {/* Header */}
      <div className={`border-b ${theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')}`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')}>
                <ArrowLeft className={`w-5 h-5 ${theme(isDarkMode, 'text-gray-300', 'text-gray-700')}`} />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{runningProject.name}</h1>
                <p className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                  Location: {runningProject.location_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Network Status */}
              <div className={`p-2 rounded-lg ${networkStatus ? 'text-green-500' : 'text-red-500'}`}>
                {networkStatus ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              </div>
              {/* Dark Mode Toggle */}
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
          <div className="flex gap-4 text-sm mb-4">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`font-semibold ${color}`}>{value}</div>
                <div className={theme(isDarkMode, 'text-gray-400', 'text-gray-600')}>{label}</div>
              </div>
            ))}
          </div>

          {/* Desktop Input */}
          {isDesktop && (
            <div className="flex gap-3">
              <input
                type="text"
                value={scanInput}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && scanInput.trim() && handleScan(scanInput.trim())}
                placeholder="Scan lot number..."
                disabled={isLoading}
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono transition-all ${
                  theme(isDarkMode, 
                    'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400', 
                    'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500'
                  )
                } ${error ? 'border-red-500 animate-pulse' : ''} ${isLoading ? 'opacity-50' : ''}`}
                autoFocus
              />
              {totalScanned > 0 && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                    theme(isDarkMode, 'bg-green-600 hover:bg-green-500', 'bg-green-600 hover:bg-green-700')
                  } text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Send className="w-4 h-4" />
                  {isLoading ? 'Submitting...' : `Submit (${totalScanned})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={isDesktop ? "p-4" : "p-4 pb-32"}>
        <div className={`rounded-lg p-4 ${
          theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')
        } border`}>
          <h3 className="font-semibold mb-3">Scanned Lots</h3>
          {sortedLots.length === 0 ? (
            <div className={`text-center py-8 ${theme(isDarkMode, 'text-gray-400', 'text-gray-500')}`}>
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No lots scanned yet</p>
              <p className="text-sm">Start scanning to see lots here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedLots.map((lot) => {
                const isRecent = isRecentlyScanned(lot.lotName);
                const lotVariance = lot.scannedQty - lot.theoreticalQty;

                return (
                  <div 
                    key={lot.lotName}
                    className={`flex justify-between items-center p-3 rounded-lg transition-all duration-500 ${
                      isRecent 
                        ? theme(isDarkMode, 'bg-green-800 border-2 border-green-400 scale-105', 'bg-green-100 border-2 border-green-400 scale-105')
                        : theme(isDarkMode, 'border-gray-600 bg-gray-700', 'border-gray-200 bg-gray-50')
                    } border`}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className={`w-5 h-5 ${isRecent ? 'animate-pulse' : ''} ${
                          theme(isDarkMode, 'text-green-400', 'text-green-600')
                        }`} />
                        <div>
                          <div className={`font-mono font-bold ${
                            theme(isDarkMode, 'text-gray-100', 'text-gray-900')
                          }`}>
                            {lot.lotName}
                          </div>
                          <div className={`text-xs ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                            {lot.productName}
                          </div>
                        </div>
                        {isRecent && (
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-bounce">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        <span className={
                          lotVariance === 0 
                            ? theme(isDarkMode, 'text-green-400', 'text-green-600')
                            : lotVariance > 0 
                              ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
                              : theme(isDarkMode, 'text-red-400', 'text-red-600')
                        }>
                          {isRecent ? <span className="animate-bounce">{lot.scannedQty}</span> : lot.scannedQty}
                        </span>
                        <span className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-400')}`}>
                          /{lot.theoreticalQty}
                        </span>
                      </div>
                      {lotVariance !== 0 && (
                        <div className={`text-xs font-bold ${lotVariance > 0 
                          ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
                          : theme(isDarkMode, 'text-red-400', 'text-red-600')
                        }`}>
                          {lotVariance > 0 ? '+' : ''}{lotVariance}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Controls */}
      {!isDesktop && (
        <div className={`fixed bottom-0 left-0 right-0 border-t p-4 ${
          theme(isDarkMode, 'bg-gray-800 border-gray-700', 'bg-white border-gray-200')
        }`}>
          <div className="space-y-3">
            <input
              type="text"
              value={scanInput}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && scanInput.trim() && handleScan(scanInput.trim())}
              placeholder="Scan lot number..."
              disabled={isLoading}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono transition-all ${
                theme(isDarkMode, 
                  'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400', 
                  'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500'
                )
              } ${error ? 'border-red-500 animate-pulse' : ''} ${isLoading ? 'opacity-50' : ''}`}
              autoFocus
            />
            {totalScanned > 0 && (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={`w-full py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  theme(isDarkMode, 'bg-green-600 hover:bg-green-500', 'bg-green-600 hover:bg-green-700')
                } text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Send className="w-4 h-4" />
                {isLoading ? 'Submitting...' : `Submit (${totalScanned})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
          {error}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-4 rounded-lg ${theme(isDarkMode, 'bg-gray-800', 'bg-white')}`}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className={theme(isDarkMode, 'text-white', 'text-gray-900')}>Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
