import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Package, CheckCircle, AlertCircle } from 'lucide-react';

export default function ProductScanning() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [scannedLots, setScannedLots] = useState({});
  const [scanInput, setScanInput] = useState('');
  const [lastScannedLot, setLastScannedLot] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inputError, setInputError] = useState(false);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Mock product data - in real app this would come from props or API
  const products = [
    {
      id: 1,
      code: '22027',
      name: 'Panam Care Herbal Glow Facial Kit',
      totalLots: 4,
      theoretical: 43,
      rack: 'A-15',
      lots: [
        { id: '0099362', theoretical: 8, expiry: '2025-03-15' },
        { id: '0099363', theoretical: 12, expiry: '2025-04-20' },
        { id: '0099364', theoretical: 5, expiry: '2025-05-10' },
        { id: '0099365', theoretical: 18, expiry: '2025-06-05' }
      ]
    },
    {
      id: 2,
      code: '20328',
      name: 'Dermalogika Sheet Mask',
      totalLots: 2,
      theoretical: 25,
      rack: 'B-08',
      lots: [
        { id: '0088451', theoretical: 15, expiry: '2025-02-28' },
        { id: '0088452', theoretical: 10, expiry: '2025-03-15' }
      ]
    },
    {
      id: 3,
      code: '21022',
      name: 'Nirvana Glitter Nail Enamel',
      totalLots: 6,
      theoretical: 72,
      rack: 'C-22',
      lots: [
        { id: '0077341', theoretical: 12, expiry: '2025-01-30' },
        { id: '0077342', theoretical: 8, expiry: '2025-02-15' },
        { id: '0077343', theoretical: 15, expiry: '2025-03-20' },
        { id: '0077344', theoretical: 10, expiry: '2025-04-10' },
        { id: '0077345', theoretical: 14, expiry: '2025-05-25' },
        { id: '0077346', theoretical: 13, expiry: '2025-06-30' }
      ]
    }
  ];

  // Initialize with first product for demo
  useEffect(() => {
    if (!selectedProduct && products.length > 0) {
      setSelectedProduct(products[0]);
    }
  }, [selectedProduct]);

  const getTotalScanned = () => {
    return Object.values(scannedLots).reduce((sum, count) => sum + count, 0);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setScanInput(value);
    
    if (value.length >= 7 && /^\d{7}$/.test(value)) {
      processLotScan(value.trim());
    }
  };

  const handleScanInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      processLotScan(e.target.value.trim());
    }
  };

  const processLotScan = (lotNumber) => {
    const lot = selectedProduct.lots.find(l => l.id === lotNumber);
    
    if (lot) {
      setScannedLots(prev => ({
        ...prev,
        [lotNumber]: (prev[lotNumber] || 0) + 1
      }));
      
      setLastScannedLot({
        lotId: lotNumber,
        expiry: lot.expiry,
        timestamp: new Date(),
        count: (scannedLots[lotNumber] || 0) + 1
      });
      
      setScanHistory(prev => [
        { lotId: lotNumber, timestamp: new Date() },
        ...prev.slice(0, 4)
      ]);
      
      setScanInput('');
    } else {
      // Check if this lot belongs to another product
      const otherProduct = products.find(p => 
        p.id !== selectedProduct.id && 
        p.lots.some(l => l.id === lotNumber)
      );
      
      if (otherProduct) {
        setErrorMessage(`Lot ${lotNumber} belongs to "${otherProduct.name}" [${otherProduct.code}], not to the current product.`);
      } else {
        setErrorMessage(`Lot ${lotNumber} is not recognized in the system. Please check the lot number and try again.`);
      }
      
      setShowErrorModal(true);
      setInputError(true);
      setScanInput('');
      
      // Remove error styling after animation
      setTimeout(() => {
        setInputError(false);
      }, 500);
      
      // Auto-close modal after 5 seconds
      setTimeout(() => {
        setShowErrorModal(false);
      }, 5000);
    }
  };

  const getSortedLots = () => {
    if (!selectedProduct) return [];
    
    const scannedLotIds = Object.keys(scannedLots);
    const scannedLotsData = selectedProduct.lots.filter(lot => scannedLotIds.includes(lot.id));
    const unscannedLotsData = selectedProduct.lots.filter(lot => !scannedLotIds.includes(lot.id));
    
    scannedLotsData.sort((a, b) => {
      const aTime = scanHistory.find(h => h.lotId === a.id)?.timestamp || new Date(0);
      const bTime = scanHistory.find(h => h.lotId === b.id)?.timestamp || new Date(0);
      return bTime - aTime;
    });
    
    return [...scannedLotsData, ...unscannedLotsData];
  };

  const handleSubmit = () => {
    console.log('Submitting scanned data:', {
      product: selectedProduct,
      scannedLots,
      totalScanned: getTotalScanned()
    });
    // In real app, this would navigate to review screen
  };

  const handleBackToList = () => {
    // In real app, this would navigate back to product list
    setSelectedProduct(null);
    setScannedLots({});
    setScanInput('');
    setLastScannedLot(null);
    setScanHistory([]);
  };

  if (!selectedProduct) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <Package className="w-16 h-16 mx-auto mb-4" />
          <p>No product selected for scanning</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Shake animation styles */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
      
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

        {/* Header */}
        <div className={`shadow-sm p-4 border-b transition-colors duration-300 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={handleBackToList}>
              <ArrowLeft className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
            </button>
            <div className="flex-1">
              <h1 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {selectedProduct.name.length > 25 ? 
                  `${selectedProduct.name.substring(0, 25)}...` : 
                  selectedProduct.name
                }
              </h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                [{selectedProduct.code}] • Rack: {selectedProduct.rack}
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 text-sm mb-4">
            <div className="text-center">
              <div className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {selectedProduct.theoretical}
              </div>
              <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Expected</div>
            </div>
            <div className="text-center">
              <div className={`font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {getTotalScanned()}
              </div>
              <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Scanned</div>
            </div>
            <div className="text-center">
              <div className={`font-semibold ${getTotalScanned() - selectedProduct.theoretical === 0 ? 
                (isDarkMode ? 'text-green-400' : 'text-green-600') : 
                getTotalScanned() - selectedProduct.theoretical > 0 ? 
                (isDarkMode ? 'text-blue-400' : 'text-blue-600') : 
                (isDarkMode ? 'text-red-400' : 'text-red-600')}`}>
                {getTotalScanned() > 0 ? (getTotalScanned() - selectedProduct.theoretical > 0 ? '+' : '') + 
                 (getTotalScanned() - selectedProduct.theoretical) : '-'}
              </div>
              <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Variance</div>
            </div>
          </div>

          {isDesktop && (
            <div className="flex gap-3">
              <input
                type="text"
                value={scanInput}
                onChange={handleInputChange}
                onKeyPress={handleScanInput}
                placeholder="Scan lot number (e.g., 0099362)..."
                className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-lg font-mono transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
                } ${inputError ? 'shake border-red-500 focus:ring-red-400 focus:border-red-400' : ''}`}
                autoFocus
              />
              {getTotalScanned() > 0 && (
                <button
                  onClick={handleSubmit}
                  className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors duration-300 ${
                    isDarkMode 
                      ? 'bg-green-600 text-white hover:bg-green-500' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Submit ({getTotalScanned()})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className={isDesktop ? "flex-1 overflow-auto p-4" : "flex-1 overflow-auto pb-32"}>
          <div className={isDesktop ? "grid grid-cols-2 gap-6" : "p-4"}>
            {/* Lot Status */}
            <div className={`rounded-lg shadow-sm p-4 transition-colors duration-300 ${
              isDarkMode ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>Lot Status</h3>
              <div className="space-y-3">
                {getSortedLots().map((lot) => {
                  const scannedCount = scannedLots[lot.id] || 0;
                  const variance = scannedCount - lot.theoretical;
                  const isScanned = scannedCount > 0;
                  const isRecentlyScanned = lastScannedLot?.lotId === lot.id;
                  const timeSinceLastScan = lastScannedLot?.timestamp ? 
                    (new Date() - lastScannedLot.timestamp) / 1000 : null;
                  const showRecentAnimation = isRecentlyScanned && timeSinceLastScan < 3;
                  
                  return (
                    <div 
                      key={lot.id} 
                      className={`relative flex justify-between items-center p-4 rounded-lg transition-all duration-500 ${
                        showRecentAnimation ? 
                          (isDarkMode ? 'bg-green-800 border-2 border-green-400 shadow-lg scale-105' : 'bg-green-100 border-2 border-green-400 shadow-lg scale-105') :
                        isScanned ? 
                          (isDarkMode ? 'bg-emerald-900 border border-emerald-400' : 'bg-blue-50 border border-blue-200') : 
                          (isDarkMode ? 'bg-slate-800 border border-slate-600' : 'bg-gray-50 border border-gray-200')
                      }`}
                    >
                      {showRecentAnimation && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center gap-3">
                          {isScanned ? (
                            <CheckCircle className={`w-6 h-6 ${showRecentAnimation ? 
                              (isDarkMode ? 'text-green-400 animate-pulse' : 'text-green-600 animate-pulse') : 
                              (isDarkMode ? 'text-emerald-400' : 'text-green-600')}`} />
                          ) : (
                            <div className={`w-6 h-6 border-2 rounded-full ${
                              isDarkMode ? 'border-slate-400' : 'border-gray-300'
                            }`}></div>
                          )}
                          <div className={`font-mono font-bold text-lg ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                            {lot.id}
                          </div>
                          {showRecentAnimation && (
                            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-medium animate-bounce">
                              ✓ SCANNED
                            </span>
                          )}
                        </div>
                        <div className={`text-sm ml-9 ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                          Exp: {lot.expiry}
                          {showRecentAnimation && (
                            <span className={`ml-2 font-medium ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                              | Count: {scannedCount} | {lastScannedLot.timestamp.toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          <span className={
                            isScanned ? (
                              variance === 0 ? (isDarkMode ? 'text-emerald-400' : 'text-green-600') : 
                              variance > 0 ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : 
                              (isDarkMode ? 'text-red-400' : 'text-red-600')
                            ) : (isDarkMode ? 'text-slate-400' : 'text-gray-400')
                          }>
                            {showRecentAnimation ? (
                              <span className="animate-bounce">{scannedCount}</span>
                            ) : (
                              scannedCount
                            )}
                          </span>
                          <span className={`text-lg ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}> / {lot.theoretical}</span>
                        </div>
                        {isScanned && variance !== 0 && (
                          <div className={`text-sm font-bold ${variance > 0 ? 
                            (isDarkMode ? 'text-blue-400' : 'text-blue-600') : 
                            (isDarkMode ? 'text-red-400' : 'text-red-600')}`}>
                            {variance > 0 ? '+' : ''}{variance}
                          </div>
                        )}
                        {!isScanned && (
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Not scanned</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop Info Panel */}
            {isDesktop && (
              <div className="space-y-4">
                {getTotalScanned() === 0 && (
                  <div className={`border rounded-lg p-6 text-center transition-colors duration-300 ${
                    isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <Package className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                    <h3 className={`font-medium mb-3 text-lg ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>Ready to Scan</h3>
                    <p className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>
                      Use the scanner input above to scan lot numbers.
                    </p>
                  </div>
                )}

                {scanHistory.length > 0 && (
                  <div className={`rounded-lg shadow-sm p-4 transition-colors duration-300 ${
                    isDarkMode ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-gray-200'
                  }`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>Recent Scans</h3>
                    <div className="space-y-2">
                      {scanHistory.slice(0, 5).map((scan, index) => (
                        <div key={index} className={`flex justify-between items-center py-2 border-b last:border-0 ${
                          isDarkMode ? 'border-slate-600' : 'border-gray-100'
                        }`}>
                          <span className={`font-mono font-medium ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                            {scan.lotId}
                          </span>
                          <span className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-500'}`}>
                            {scan.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {getTotalScanned() > 0 && (
                  <div className={`rounded-lg shadow-sm p-4 transition-colors duration-300 ${
                    isDarkMode ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-gray-200'
                  }`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>Progress</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>Lots Scanned:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                          {Object.keys(scannedLots).length} / {selectedProduct.lots.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>Completion:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                          {Math.round((Object.keys(scannedLots).length / selectedProduct.lots.length) * 100)}%
                        </span>
                      </div>
                      <div className={`w-full rounded-full h-3 ${isDarkMode ? 'bg-slate-600' : 'bg-gray-200'}`}>
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            isDarkMode ? 'bg-blue-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${(Object.keys(scannedLots).length / selectedProduct.lots.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Instructions */}
            {!isDesktop && getTotalScanned() === 0 && (
              <div className={`border rounded-lg p-4 text-center mt-4 transition-colors duration-300 ${
                isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <Package className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`} />
                <h3 className={`font-medium mb-2 ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>Ready to Scan</h3>
                <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                  Use the scanner input at the bottom to scan lot numbers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Bottom Controls */}
        {!isDesktop && (
          <div className={`fixed bottom-0 left-0 right-0 border-t shadow-lg transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="max-w-md mx-auto p-4">
              <div className="space-y-3">
                <input
                  type="text"
                  value={scanInput}
                  onChange={handleInputChange}
                  onKeyPress={handleScanInput}
                  placeholder="Scan lot number (e.g., 0099362)..."
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-lg font-mono transition-colors duration-300 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
                  } ${inputError ? 'shake border-red-500 focus:ring-red-400 focus:border-red-400' : ''}`}
                  autoFocus
                />
                {getTotalScanned() > 0 && (
                  <button
                    onClick={handleSubmit}
                    className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors duration-300 ${
                      isDarkMode 
                        ? 'bg-green-600 text-white hover:bg-green-500' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    Submit All Lots ({getTotalScanned()} total pieces)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowErrorModal(false)}
            ></div>
            <div className={`relative w-full max-w-md rounded-lg shadow-2xl p-6 transform transition-all ${
              isDarkMode ? 'bg-gray-800 border border-red-800' : 'bg-white border-2 border-red-200'
            } ${showErrorModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-red-900' : 'bg-red-100'
                }`}>
                  <AlertCircle className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Invalid Lot Number
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {errorMessage}
                  </p>
                  
                  {selectedProduct && (
                    <div className={`mt-4 p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <p className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Valid lots for this product:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.lots.map(lot => (
                          <span 
                            key={lot.id} 
                            className={`text-xs px-2 py-1 rounded font-mono ${
                              isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {lot.id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-red-600 text-white hover:bg-red-500' 
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}