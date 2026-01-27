import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
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

// Tutorial Route Component - checks if tutorial has been seen
const TutorialRoute: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [checkingTutorial, setCheckingTutorial] = React.useState(true);
  const navigate = useNavigate();
  
  React.useEffect(() => {
    const checkTutorialStatus = async () => {
      if (!user?.id) {
        setCheckingTutorial(false);
        return;
      }
      
      // If profile is already loaded and has tutorial_seen, use it
      if (profile && 'tutorial_seen' in profile) {
        if (profile.tutorial_seen) {
          // Tutorial already seen, redirect to main
          navigate('/main', { replace: true });
          return;
        }
        setCheckingTutorial(false);
        return;
      }
      
      // Otherwise, fetch profile to check tutorial_seen
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('tutorial_seen')
          .eq('id', user.id) // profiles.id = auth.users.id
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error checking tutorial status:', error);
        }
        
        if (data?.tutorial_seen) {
          // Tutorial already seen, redirect to main
          navigate('/main', { replace: true });
          return;
        }
      } catch (err) {
        console.error('Error in checkTutorialStatus:', err);
      } finally {
        setCheckingTutorial(false);
      }
    };
    
    if (!loading) {
      checkTutorialStatus();
    }
  }, [user, profile, loading, navigate]);
  
  // Show loading while checking tutorial status (prevents flicker)
  if (loading || checkingTutorial) {
    return (
      <div className="mobile-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }
  
  // If no user, redirect to welcome
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  // Show tutorial
  return <Tutorial />;
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
            <TutorialRoute />
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
