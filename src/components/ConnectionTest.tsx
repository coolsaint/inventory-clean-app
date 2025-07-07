import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import { CheckCircle, XCircle, Wifi, AlertTriangle } from 'lucide-react';

interface ConnectionTestProps {
  onClose: () => void;
}

export default function ConnectionTest({ onClose }: ConnectionTestProps) {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      // Test basic connectivity to Odoo
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://t.shajgoj.store'}/web/database/selector`, {
        method: 'GET',
        mode: 'cors',
      });

      if (response.ok) {
        setConnectionResult({
          success: true,
          message: 'Successfully connected to Odoo server!',
          details: {
            status: response.status,
            url: response.url,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        setConnectionResult({
          success: false,
          message: `Server responded with status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        });
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      
      let errorMessage = 'Failed to connect to Odoo server';
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Network error - check if server is accessible';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS error - server may need CORS configuration';
      }

      setConnectionResult({
        success: false,
        message: errorMessage,
        details: {
          error: error.message,
          type: error.name,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testLoginEndpoint = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      // Test the specific inventory app login endpoint
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://t.shajgoj.store'}/inventory_app/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mobile_phone: 'test',
          pin: 'test'
        }),
      });

      const data = await response.json();

      if (response.ok || data.hasOwnProperty('success')) {
        setConnectionResult({
          success: true,
          message: 'Inventory app endpoint is accessible!',
          details: {
            status: response.status,
            response: data,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        setConnectionResult({
          success: false,
          message: `Endpoint responded with status ${response.status}`,
          details: {
            status: response.status,
            response: data
          }
        });
      }
    } catch (error: any) {
      console.error('Login endpoint test error:', error);
      
      setConnectionResult({
        success: false,
        message: 'Failed to reach inventory app endpoint',
        details: {
          error: error.message,
          type: error.name,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Connection Test</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p><strong>Server URL:</strong> {import.meta.env.VITE_API_BASE_URL || 'https://t.shajgoj.store'}</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={testConnection}
              disabled={isTestingConnection}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              {isTestingConnection ? 'Testing...' : 'Test Basic Connection'}
            </button>

            <button
              onClick={testLoginEndpoint}
              disabled={isTestingConnection}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {isTestingConnection ? 'Testing...' : 'Test Login Endpoint'}
            </button>
          </div>

          {connectionResult && (
            <div className={`p-4 rounded-lg border ${
              connectionResult.success 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {connectionResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">
                  {connectionResult.success ? 'Success' : 'Failed'}
                </span>
              </div>
              
              <p className="text-sm mb-2">{connectionResult.message}</p>
              
              {connectionResult.details && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-gray-700 overflow-auto">
                    {JSON.stringify(connectionResult.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Note:</strong> If tests fail, check:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Server is running and accessible</li>
              <li>CORS is configured for your domain</li>
              <li>Inventory app module is installed</li>
              <li>Network connectivity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
