import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, User, MapPin, Smartphone, Bell, Globe, Ruler, LogOut } from 'lucide-react';
import logo from '../assets/logo.png';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { setLastRoute, setLastMainTab } = useApp();
  
  // Track navigation state when Settings opens
  useEffect(() => {
    const fromState = (location.state as { from?: { pathname: string; mainTab?: string } })?.from;
    if (fromState) {
      setLastRoute(fromState.pathname);
      if (fromState.mainTab) {
        setLastMainTab(fromState.mainTab as any);
      }
    } else {
      // Default: Settings was opened from /main
      setLastRoute('/main');
      setLastMainTab('home');
    }
  }, [location.state, setLastRoute, setLastMainTab]);
  const [language, setLanguage] = useState('EN');
  const [units, setUnits] = useState('km');

  const handleSaveSettings = () => {
    // TODO: Save language and units to user profile/settings if needed
    // Navigate back to last screen/tab
    const fromState = (location.state as { from?: { pathname: string; mainTab?: string } })?.from;
    if (fromState?.pathname === '/main' && fromState.mainTab) {
      navigate('/main', { state: { restoreTab: fromState.mainTab } });
    } else if (fromState?.pathname) {
      navigate(fromState.pathname);
    } else {
      navigate('/main', { state: { restoreTab: 'home' } });
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      // Reset tutorial_seen to FALSE before logout
      if (user?.id) {
        try {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ tutorial_seen: false })
            .eq('id', user.id); // profiles.id = auth.users.id, RLS enforces auth.uid() = id
          
          if (updateError) {
            // Log error but don't block logout
            console.error('Error resetting tutorial_seen on logout:', updateError);
          }
        } catch (err) {
          // Log error but don't block logout
          console.error('Error resetting tutorial_seen on logout:', err);
        }
      }
      
      // Proceed with logout regardless of update result
      const { error } = await signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        navigate('/');
      }
    }
  };

  const languages = [
    { code: 'EN', name: 'English' },
    { code: 'DE', name: 'Deutsch' },
    { code: 'ES', name: 'Español' },
    { code: 'FR', name: 'Français' },
    { code: 'IT', name: 'Italiano' },
    { code: 'PT', name: 'Português' },
  ];

  return (
    <div className="mobile-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 flex items-center gap-3 shrink-0">
        <button
          onClick={handleSaveSettings}
          className="p-1 hover:bg-[var(--pine-green)] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img 
            src={logo} 
            alt="GeoSense logo" 
            className="w-6 h-6"
            style={{ objectFit: 'contain' }}
          />
          <h3>Settings</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Profile Section */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-[var(--grass-green)]" />
            <h4 className="text-[var(--deep-forest)]">Profile</h4>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              {authLoading ? (
                <p className="text-[var(--deep-forest)] text-sm opacity-50">Loading...</p>
              ) : (
                <p className="text-[var(--deep-forest)]">
                  {user?.email || 'Not signed in'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Management Sections */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <button
            onClick={() => {
              // Navigate to edit mode - user can select geofence from MapTab
              navigate('/draw-geofence?mode=edit', {
                state: {
                  mode: 'edit',
                  from: { pathname: '/settings', mainTab: undefined }
                }
              });
            }}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <MapPin className="w-5 h-5 text-[var(--grass-green)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Edit zones</span>
            <span className="text-gray-400">→</span>
          </button>
          
          <button
            onClick={() => navigate('/link-devices?mode=edit', {
              state: {
                mode: 'edit',
                from: { pathname: '/settings', mainTab: undefined }
              }
            })}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <Smartphone className="w-5 h-5 text-[var(--accent-aqua)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Manage Devices</span>
            <span className="text-gray-400">→</span>
          </button>
          
          <button
            onClick={() => navigate('/customize-alerts?mode=edit', {
              state: {
                mode: 'edit',
                from: { pathname: '/settings', mainTab: undefined }
              }
            })}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <Bell className="w-5 h-5 text-[var(--high-yellow)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Set Alerts</span>
            <span className="text-gray-400">→</span>
          </button>
          
          <button
            onClick={async () => {
              // Reset tutorial_seen to FALSE so user can see tutorial again
              if (user?.id) {
                try {
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ tutorial_seen: false })
                    .eq('id', user.id); // profiles.id = auth.users.id, RLS enforces auth.uid() = id
                  
                  if (updateError) {
                    console.error('Error resetting tutorial_seen:', updateError);
                    // Still navigate even if update fails
                  }
                } catch (err) {
                  console.error('Error resetting tutorial_seen:', err);
                  // Still navigate even if update fails
                }
              }
              // Navigate to tutorial (optimistically, even if update fails)
              navigate('/tutorial');
            }}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <MapPin className="w-5 h-5 text-[var(--grass-green)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Tutorial</span>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* Language Selection */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 h-5 text-[var(--grass-green)]" />
            <h4 className="text-[var(--deep-forest)]">Language</h4>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--grass-green)] text-[var(--deep-forest)]"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Units Selection */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Ruler className="w-5 h-5 text-[var(--grass-green)]" />
            <h4 className="text-[var(--deep-forest)]">Units</h4>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setUnits('km')}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                units === 'km'
                  ? 'border-[var(--grass-green)] bg-[var(--grass-green)] text-white'
                  : 'border-gray-300 text-[var(--deep-forest)] hover:border-[var(--grass-green)]'
              }`}
            >
              Kilometers
            </button>
            <button
              onClick={() => setUnits('miles')}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                units === 'miles'
                  ? 'border-[var(--grass-green)] bg-[var(--grass-green)] text-white'
                  : 'border-gray-300 text-[var(--deep-forest)] hover:border-[var(--grass-green)]'
              }`}
            >
              Miles
            </button>
          </div>
        </div>

        {/* Save Button */}
        <GeoButton variant="primary" onClick={handleSaveSettings} className="w-full">
          Save Settings
        </GeoButton>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full p-4 flex items-center justify-center gap-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </div>
  );
};
