import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Package, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Theme utility
const theme = (isDark: boolean, darkClass: string, lightClass: string) => 
  isDark ? darkClass : lightClass;

// Mock data
const MOCK_PRODUCT = {
  id: 1, 
  code: '22027', 
  name: 'Panam Care Herbal Glow Facial Kit',
  theoretical: 43, 
  rack: 'A-15',
  lots: [
    { id: '0099362', theoretical: 8, expiry: '2025-03-15' },
    { id: '0099363', theoretical: 12, expiry: '2025-04-20' },
    { id: '0099364', theoretical: 5, expiry: '2025-05-10' },
    { id: '0099365', theoretical: 18, expiry: '2025-06-05' }
  ]
};

// Custom hook for scanner logic
const useScanner = () => {
  const [scannedLots, setScannedLots] = useState<{[key: string]: number}>({});
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{lotId: string, time: number} | null>(null);
  const [error, setError] = useState('');

  const totalScanned = Object.values(scannedLots).reduce((sum, count) => sum + count, 0);
  const variance = totalScanned - MOCK_PRODUCT.theoretical;
  
  const isRecentlyScanned = (lotId: string) => 
    lastScanned?.lotId === lotId && Date.now() - lastScanned.time < 3000;

  const handleScan = (lotNumber: string) => {
    const lot = MOCK_PRODUCT.lots.find(l => l.id === lotNumber);
    if (!lot) {
      setError(`Invalid lot: ${lotNumber}`);
      setTimeout(() => setError(''), 3000);
      setScanInput('');
      return;
    }
    
    setScannedLots(prev => ({ ...prev, [lotNumber]: (prev[lotNumber] || 0) + 1 }));
    setLastScanned({ lotId: lotNumber, time: Date.now() });
    setScanInput('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScanInput(value);
    if (value.length === 7 && /^\d{7}$/.test(value)) {
      handleScan(value);
    }
  };

  const handleSubmit = () => {
    console.log('Submitting:', { scannedLots, totalScanned });
    alert(`Submitted ${totalScanned} items successfully!`);
  };

  return {
    scannedLots,
    scanInput,
    error,
    totalScanned,
    variance,
    isRecentlyScanned,
    handleScan,
    handleInputChange,
    handleSubmit
  };
};

export default function Scanner() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const navigate = useNavigate();
  
  // Use custom scanner hook
  const {
    scannedLots,
    scanInput,
    error,
    totalScanned,
    variance,
    isRecentlyScanned,
    handleInputChange,
    handleSubmit
  } = useScanner();

  // Screen size detection
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Computed values
  const getVarianceColor = () => {
    if (variance === 0) return theme(isDarkMode, 'text-green-400', 'text-green-600');
    return variance > 0 
      ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
      : theme(isDarkMode, 'text-red-400', 'text-red-600');
  };

  const sortedLots = MOCK_PRODUCT.lots.sort((a, b) => {
    const aScanned = scannedLots[a.id] > 0;
    const bScanned = scannedLots[b.id] > 0;
    if (aScanned !== bScanned) return bScanned ? 1 : -1;
    return isRecentlyScanned(b.id) ? 1 : -1;
  });

  const stats = [
    { label: 'Expected', value: MOCK_PRODUCT.theoretical, color: theme(isDarkMode, 'text-gray-300', 'text-gray-700') },
    { label: 'Scanned', value: totalScanned, color: theme(isDarkMode, 'text-blue-400', 'text-blue-600') },
    { label: 'Variance', value: variance > 0 ? `+${variance}` : variance || '-', color: getVarianceColor() }
  ];

  const LotItem = ({ lot }: { lot: typeof MOCK_PRODUCT.lots[0] }) => {
    const scannedCount = scannedLots[lot.id] || 0;
    const lotVariance = scannedCount - lot.theoretical;
    const isScanned = scannedCount > 0;
    const isRecent = isRecentlyScanned(lot.id);

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
              {lot.id}
            </div>
            {isRecent && (
              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-bounce">
                ✓
              </span>
            )}
          </div>
          <div className={`text-xs ml-8 ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
            Exp: {lot.expiry}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            <span className={isScanned 
              ? (lotVariance === 0 
                  ? theme(isDarkMode, 'text-green-400', 'text-green-600')
                  : lotVariance > 0 
                    ? theme(isDarkMode, 'text-blue-400', 'text-blue-600')
                    : theme(isDarkMode, 'text-red-400', 'text-red-600'))
              : theme(isDarkMode, 'text-gray-400', 'text-gray-400')
            }>
              {isRecent ? <span className="animate-bounce">{scannedCount}</span> : scannedCount}
            </span>
            <span className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-400')}`}>
              /{lot.theoretical}
            </span>
          </div>
          {isScanned && lotVariance !== 0 && (
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
  };

  const ScanInput = ({ isMobile = false }) => (
    <div className={isMobile ? "space-y-3" : "flex gap-3"}>
      <input
        type="text"
        value={scanInput}
        onChange={handleInputChange}
        onKeyDown={(e) => e.key === 'Enter' && scanInput.trim() && handleInputChange({ target: { value: scanInput.trim() } } as any)}
        placeholder="Scan lot number (e.g., 0099362)..."
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
          className={`${isMobile ? 'w-full' : 'px-4'} py-2 rounded-lg font-medium flex items-center ${
            isMobile ? 'justify-center' : ''
          } gap-2 transition-colors ${
            theme(isDarkMode, 'bg-green-600 hover:bg-green-500', 'bg-green-600 hover:bg-green-700')
          } text-white`}
        >
          <Send className="w-4 h-4" />
          Submit ({totalScanned})
        </button>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors ${
      theme(isDarkMode, 'bg-gray-900 text-white', 'bg-gray-50 text-gray-900')
    }`}>
      {/* Header */}
      <div className={`border-b ${theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')}`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/login')}>
                <ArrowLeft className={`w-5 h-5 ${theme(isDarkMode, 'text-gray-300', 'text-gray-700')}`} />
              </button>
              <div>
                <h1 className="text-lg font-semibold">{MOCK_PRODUCT.name}</h1>
                <p className={`text-sm ${theme(isDarkMode, 'text-gray-400', 'text-gray-600')}`}>
                  [{MOCK_PRODUCT.code}] • Rack: {MOCK_PRODUCT.rack}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg transition-colors ${
                theme(isDarkMode, 'bg-gray-700 hover:bg-gray-600', 'bg-gray-100 hover:bg-gray-200')
              }`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
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

          {isDesktop && <ScanInput />}
        </div>
      </div>

      {/* Main Content */}
      <div className={isDesktop ? "p-4" : "p-4 pb-32"}>
        <div className={`rounded-lg p-4 ${
          theme(isDarkMode, 'border-gray-700 bg-gray-800', 'border-gray-200 bg-white')
        } border`}>
          <h3 className="font-semibold mb-3">Lot Status</h3>
          <div className="space-y-2">
            {sortedLots.map(lot => <LotItem key={lot.id} lot={lot} />)}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Controls */}
      {!isDesktop && (
        <div className={`fixed bottom-0 left-0 right-0 border-t p-4 ${
          theme(isDarkMode, 'bg-gray-800 border-gray-700', 'bg-white border-gray-200')
        }`}>
          <ScanInput isMobile />
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
          {error}
        </div>
      )}
    </div>
  );
}
