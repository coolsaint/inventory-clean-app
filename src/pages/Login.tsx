import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, EyeOff, Smartphone, Lock, Settings } from 'lucide-react';
import ConnectionTest from '../components/ConnectionTest';
import { apiClient } from '../lib/api';

const theme = (isDark: boolean, darkClass: string, lightClass: string) => 
  isDark ? darkClass : lightClass;

export default function Login() {
  const [mobilePhone, setMobilePhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showConnectionTest, setShowConnectionTest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mobilePhone.trim() || !pin.trim()) {
      setError('Please enter both mobile phone and PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Remove formatting from phone number before sending to API
      const rawPhoneNumber = mobilePhone.replace(/\D/g, '');

      console.log('🔍 Login Debug:', {
        original: mobilePhone,
        cleaned: rawPhoneNumber,
        pin: pin.trim()
      });

      const response = await apiClient.login({
        mobile_phone: rawPhoneNumber,
        pin: pin.trim()
      });

      if (response.success) {
        // Store auth data in localStorage for now
        localStorage.setItem('auth_token', response.api_token || '');
        localStorage.setItem('sale_person_info', JSON.stringify(response.sale_person_info || {}));
        navigate('/scanner');
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (err: any) {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as phone number for Bangladesh numbers (11 digits)
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 11)}`; // Allow up to 11 digits
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setMobilePhone(formatted);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors ${
      theme(isDarkMode, 'bg-gray-900', 'bg-gray-50')
    }`}>
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className={`fixed top-4 right-4 p-2 rounded-lg transition-colors ${
          theme(isDarkMode, 'bg-gray-800 hover:bg-gray-700', 'bg-white hover:bg-gray-100')
        } shadow-lg`}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      <div className={`w-full max-w-md p-8 rounded-lg shadow-lg transition-colors ${
        theme(isDarkMode, 'bg-gray-800 border border-gray-700', 'bg-white border border-gray-200')
      }`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            theme(isDarkMode, 'bg-blue-900 text-blue-400', 'bg-blue-100 text-blue-600')
          }`}>
            <Package className="w-8 h-8" />
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${
            theme(isDarkMode, 'text-white', 'text-gray-900')
          }`}>
            Inventory Scanner
          </h1>
          <p className={`text-sm ${
            theme(isDarkMode, 'text-gray-400', 'text-gray-600')
          }`}>
            Sign in to start scanning inventory
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mobile Phone Input */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme(isDarkMode, 'text-gray-300', 'text-gray-700')
            }`}>
              Mobile Phone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Smartphone className={`w-5 h-5 ${
                  theme(isDarkMode, 'text-gray-400', 'text-gray-400')
                }`} />
              </div>
              <input
                type="tel"
                value={mobilePhone}
                onChange={handlePhoneChange}
                placeholder="123-456-7890"
                required
                disabled={isLoading}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  theme(isDarkMode,
                    'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400',
                    'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
                  )
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {/* PIN Input */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme(isDarkMode, 'text-gray-300', 'text-gray-700')
            }`}>
              PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className={`w-5 h-5 ${
                  theme(isDarkMode, 'text-gray-400', 'text-gray-400')
                }`} />
              </div>
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your PIN"
                required
                disabled={isLoading}
                className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  theme(isDarkMode,
                    'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400',
                    'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
                  )
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                disabled={isLoading}
                className={`absolute inset-y-0 right-0 pr-3 flex items-center ${
                  isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                {showPin ? (
                  <EyeOff className={`w-5 h-5 ${
                    theme(isDarkMode, 'text-gray-400 hover:text-gray-300', 'text-gray-400 hover:text-gray-600')
                  }`} />
                ) : (
                  <Eye className={`w-5 h-5 ${
                    theme(isDarkMode, 'text-gray-400 hover:text-gray-300', 'text-gray-400 hover:text-gray-600')
                  }`} />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !mobilePhone.trim() || !pin.trim()}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              isLoading || !mobilePhone.trim() || !pin.trim()
                ? theme(isDarkMode, 'bg-gray-600 cursor-not-allowed', 'bg-gray-300 cursor-not-allowed')
                : theme(isDarkMode, 'bg-blue-600 hover:bg-blue-500', 'bg-blue-600 hover:bg-blue-700')
            } text-white flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={`mt-6 text-center text-xs ${
          theme(isDarkMode, 'text-gray-400', 'text-gray-500')
        }`}>
          <p>Inventory Batch Submission System</p>
          <p className="mt-1">Contact your administrator for login credentials</p>

          {/* Connection Test Button */}
          <button
            onClick={() => setShowConnectionTest(true)}
            className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors ${
              theme(isDarkMode, 'text-gray-400 hover:text-gray-300', 'text-gray-500 hover:text-gray-700')
            }`}
          >
            <Settings className="w-3 h-3" />
            Test Connection
          </button>

          <div className="mt-2 text-xs">
            <p>Server: https://t.shajgoj.store</p>
            <p className="mt-1 text-green-600">🔗 Real Odoo API Integration</p>
            <p className="mt-1 text-blue-600">Use your actual Odoo credentials</p>
          </div>
        </div>
      </div>

      {/* Connection Test Modal */}
      {showConnectionTest && (
        <ConnectionTest onClose={() => setShowConnectionTest(false)} />
      )}
    </div>
  );
}
