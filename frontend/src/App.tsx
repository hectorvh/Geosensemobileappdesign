import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { useAuth } from './hooks/useAuth';
import { Welcome } from './screens/Welcome';
import { SignUp } from './screens/SignUp';
import { Login } from './screens/Login';
import { Tutorial } from './screens/Tutorial';
import { DrawGeofence } from './screens/DrawGeofence';
import { LinkDevices } from './screens/LinkDevices';
import { CustomizeAlerts } from './screens/CustomizeAlerts';
import { MainApp } from './screens/MainApp';
import { Settings } from './screens/Settings';
import { Toaster } from './components/ui/sonner';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="mobile-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/" replace />;
};

// App Content with Routes
const AppContent: React.FC = () => {

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/tutorial"
        element={
          <ProtectedRoute>
            <Tutorial />
          </ProtectedRoute>
        }
      />
      <Route
        path="/draw-geofence"
        element={
          <ProtectedRoute>
            <DrawGeofence />
          </ProtectedRoute>
        }
      />
      <Route
        path="/link-devices"
        element={
          <ProtectedRoute>
            <LinkDevices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customize-alerts"
        element={
          <ProtectedRoute>
            <CustomizeAlerts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/main"
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
export default function App() {
  return (
    <Router>
      <AppProvider>
        <div className="app-container">
          <AppContent />
          <Toaster />
        </div>
      </AppProvider>
    </Router>
  );
}
