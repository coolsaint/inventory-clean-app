import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Scanner() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [scannedLots, setScannedLots] = useState<{[key: string]: number}>({});
  const [scanInput, setScanInput] = useState('');
  // Note: These could be used for additional features like scan history display
  // const [lastScannedLot, setLastScannedLot] = useState<any>(null);
  // const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inputError, setInputError] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Mock product data
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

  // Initialize product from navigation state or default
  useEffect(() => {
    if (location.state?.selectedProduct) {
      setSelectedProduct(location.state.selectedProduct);
    } else if (!selectedProduct && products.length > 0) {
      setSelectedProduct(products[0]);
    }
  }, [location.state, selectedProduct]);

  const getTotalScanned = () => {
    return Object.values(scannedLots).reduce((sum, count) => sum + count, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScanInput(value);
    setInputError(false);
    
    if (value.length >= 7 && /^\d{7}$/.test(value)) {
      processLotScan(value.trim());
    }
  };

  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
      processLotScan((e.target as HTMLInputElement).value.trim());
    }
  };

  const processLotScan = (lotNumber: string) => {
    if (!selectedProduct) return;
    
    const lot = selectedProduct.lots.find((l: any) => l.id === lotNumber);
    
    if (lot) {
      setScannedLots(prev => ({
        ...prev,
        [lotNumber]: (prev[lotNumber] || 0) + 1
      }));
      
      // Future: Could track last scanned lot and scan history
      // setLastScannedLot({
      //   lotId: lotNumber,
      //   expiry: lot.expiry,
      //   timestamp: new Date(),
      //   count: (scannedLots[lotNumber] || 0) + 1
      // });
      // 
      // setScanHistory(prev => [
      //   { lotId: lotNumber, timestamp: new Date() },
      //   ...prev.slice(0, 4)
      // ]);
      
      setScanInput('');
      setInputError(false);
    } else {
      // Check if this lot belongs to another product
      const otherProduct = products.find(p => 
        p.id !== selectedProduct.id && 
        p.lots.some((l: any) => l.id === lotNumber)
      );
      
      if (otherProduct) {
        setErrorMessage(`Lot ${lotNumber} belongs to "${otherProduct.name}" [${otherProduct.code}], not to the current product.`);
      } else {
        setErrorMessage(`Lot number ${lotNumber} not found in any product database.`);
      }
      
      setShowErrorModal(true);
      setInputError(true);
      setTimeout(() => setInputError(false), 500);
    }
  };

  const getSortedLots = () => {
    if (!selectedProduct) return [];
    
    return selectedProduct.lots
      .map((lot: any) => ({
        ...lot,
        scannedCount: scannedLots[lot.id] || 0,
        status: scannedLots[lot.id] ? 'scanned' : 'pending'
      }))
      .sort((a: any, b: any) => {
        if (a.status === 'scanned' && b.status === 'pending') return -1;
        if (a.status === 'pending' && b.status === 'scanned') return 1;
        return a.id.localeCompare(b.id);
      });
  };

  const handleSubmit = () => {
    console.log('Submitting scanned lots:', scannedLots);
    // Here you would submit to your API
    alert('Lots submitted successfully!');
  };

  const handleBackToList = () => {
    navigate('/');
  };

  if (!selectedProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 border-b ${
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
      }`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToList}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold">Product Scanner</h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {selectedProduct.name}
                </p>
              </div>
            </div>
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

      <div className="flex flex-col h-screen">
        {/* Desktop Layout */}
        {isDesktop ? (
          <div className="flex-1 flex">
            {/* Left Panel - Product Info */}
            <div className="w-1/2 p-6 border-r border-gray-200">
              <div className={`rounded-lg border p-6 ${
                isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-semibold">{selectedProduct.name}</h2>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Code: {selectedProduct.code} • Rack: {selectedProduct.rack}
                    </p>
                  </div>
                </div>

                {/* Lots and Numbers Card */}
                <div className={`rounded-lg border p-4 mb-6 ${
                  isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
                }`}>
                  <h3 className="font-medium mb-3">Lots & Numbers</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Total Lots
                      </p>
                      <p className="text-2xl font-bold">{selectedProduct.totalLots}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Theoretical Qty
                      </p>
                      <p className="text-2xl font-bold">{selectedProduct.theoretical}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Scanned Lots
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {Object.keys(scannedLots).length}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Scanned Qty
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {getTotalScanned()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Scanner Input */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Scan Lot Number
                    </label>
                    <input
                      type="text"
                      value={scanInput}
                      onChange={handleInputChange}
                      onKeyPress={handleScanInput}
                      placeholder="Enter or scan lot number..."
                      className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
                      } ${inputError ? 'shake border-red-500 focus:ring-red-400 focus:border-red-400' : ''}`}
                      autoFocus
                    />
                  </div>

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

            {/* Right Panel - Lots List */}
            <div className="w-1/2 p-6">
              <div className={`rounded-lg border h-full overflow-hidden ${
                isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold">Product Lots</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {Object.keys(scannedLots).length} of {selectedProduct.totalLots} lots scanned
                  </p>
                </div>
                <div className="overflow-y-auto h-full p-4 space-y-3">
                  {getSortedLots().map((lot: any) => (
                    <div
                      key={lot.id}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        lot.status === 'scanned'
                          ? (isDarkMode ? 'border-green-600 bg-green-900/20' : 'border-green-200 bg-green-50')
                          : (isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50')
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-medium">{lot.id}</p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Expires: {lot.expiry}
                          </p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Theoretical: {lot.theoretical}
                          </p>
                        </div>
                        <div className="text-right">
                          {lot.status === 'scanned' ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                {lot.scannedCount}
                              </span>
                            </div>
                          ) : (
                            <div className={`text-xs px-2 py-1 rounded ${
                              isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                            }`}>
                              Pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mobile Layout */
          <div className="flex-1 flex flex-col">
            {/* Top Section - Lots and Numbers Card */}
            <div className="p-4">
              <div className={`rounded-lg border p-4 ${
                isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
              }`}>
                <h3 className="font-medium mb-3">Lots & Numbers</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Lots
                    </p>
                    <p className="text-2xl font-bold">{selectedProduct.totalLots}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Theoretical Qty
                    </p>
                    <p className="text-2xl font-bold">{selectedProduct.theoretical}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Scanned Lots
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {Object.keys(scannedLots).length}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Scanned Qty
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {getTotalScanned()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section - Lots List */}
            <div className="flex-1 px-4 pb-4">
              <div className={`rounded-lg border h-full overflow-hidden ${
                isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold">Product Lots</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {Object.keys(scannedLots).length} of {selectedProduct.totalLots} lots scanned
                  </p>
                </div>
                <div className="overflow-y-auto h-full p-4 space-y-3">
                  {getSortedLots().map((lot: any) => (
                    <div
                      key={lot.id}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        lot.status === 'scanned'
                          ? (isDarkMode ? 'border-green-600 bg-green-900/20' : 'border-green-200 bg-green-50')
                          : (isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50')
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-medium">{lot.id}</p>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Expires: {lot.expiry} • Theoretical: {lot.theoretical}
                          </p>
                        </div>
                        <div className="text-right">
                          {lot.status === 'scanned' ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-600">
                                {lot.scannedCount}
                              </span>
                            </div>
                          ) : (
                            <div className={`text-xs px-2 py-1 rounded ${
                              isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                            }`}>
                              Pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Section - Scanner Input (Mobile) */}
            <div className="p-4 border-t border-gray-200">
              <div className="space-y-3">
                <input
                  type="text"
                  value={scanInput}
                  onChange={handleInputChange}
                  onKeyPress={handleScanInput}
                  placeholder="Enter or scan lot number..."
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 ${
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
                        {selectedProduct.lots.map((lot: any) => (
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
    </div>
  );
}
