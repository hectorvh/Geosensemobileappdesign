import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
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
  const { user } = useApp();
  return user ? <>{children}</> : <Navigate to="/" replace />;
};

// App Content with Routes
const AppContent: React.FC = () => {
  const { user, setDevices, setAlerts } = useApp();

  // Initialize with mock data when user logs in
  useEffect(() => {
    if (user && setDevices) {
      // Add some mock devices for demo purposes
      const mockDevices = [
        {
          id: 'GPS001',
          animalName: 'Cow Bella',
          age: 3,
          weight: 450,
          batchId: 'A1',
          lat: 51.505,
          lng: -0.09,
          status: 'inside' as const,
          batteryLevel: 85,
          lastActive: new Date(),
          speed: 1.2,
          activeTime: 180,
          inactiveTime: 60,
          distanceToday: 3.5,
        },
        {
          id: 'GPS002',
          animalName: 'Daisy',
          age: 2,
          weight: 380,
          batchId: 'A1',
          lat: 51.507,
          lng: -0.088,
          status: 'inside' as const,
          batteryLevel: 92,
          lastActive: new Date(),
          speed: 0.8,
          activeTime: 150,
          inactiveTime: 90,
          distanceToday: 2.8,
        },
        {
          id: 'GPS003',
          animalName: 'Molly',
          age: 4,
          weight: 520,
          batchId: 'A2',
          lat: 51.503,
          lng: -0.092,
          status: 'outside-alert' as const,
          batteryLevel: 12,
          lastActive: new Date(Date.now() - 1800000),
          speed: 0.3,
          activeTime: 45,
          inactiveTime: 195,
          distanceToday: 1.2,
        },
      ];

      // Only set if devices are empty (first time initialization)
      setDevices(mockDevices);
    }
  }, [user]);

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
