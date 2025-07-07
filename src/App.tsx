import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard-simple';
import Scanner from './pages/Scanner-single-sku';

function App() {
  const { initializeFromStorage, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // Initialize auth from storage on app start
    initializeFromStorage();
  }, [initializeFromStorage]);

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? (() => {
            console.log('App: Login route - authenticated, redirecting to dashboard');
            return <Navigate to="/dashboard" replace />;
          })() : <Login />}
        />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/scanner"
          element={isAuthenticated ? <Scanner /> : (() => {
            console.log('App: Scanner route - not authenticated, redirecting to login');
            return <Navigate to="/login" replace />;
          })()}
        />
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
