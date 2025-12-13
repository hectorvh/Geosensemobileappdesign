import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useApp } from '../contexts/AppContext';
import { ArrowLeft, User, MapPin, Smartphone, Bell, Globe, Ruler, LogOut } from 'lucide-react';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [language, setLanguage] = useState(user?.language || 'EN');
  const [units, setUnits] = useState(user?.units || 'km');

  const handleSaveSettings = () => {
    if (user) {
      setUser({
        ...user,
        language: language as any,
        units: units as any,
      });
    }
    navigate('/main');
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      setUser(null);
      navigate('/');
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
          onClick={() => navigate('/main')}
          className="p-1 hover:bg-[var(--pine-green)] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3>Settings</h3>
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
              <p className="text-[var(--deep-forest)]">{user?.email || 'Not logged in'}</p>
            </div>
          </div>
        </div>

        {/* Management Sections */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <button
            onClick={() => navigate('/draw-geofence')}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <MapPin className="w-5 h-5 text-[var(--grass-green)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Edit Geofence</span>
            <span className="text-gray-400">→</span>
          </button>
          
          <button
            onClick={() => navigate('/link-devices')}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <Smartphone className="w-5 h-5 text-[var(--accent-aqua)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Manage Devices</span>
            <span className="text-gray-400">→</span>
          </button>
          
          <button
            onClick={() => navigate('/customize-alerts')}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <Bell className="w-5 h-5 text-[var(--high-yellow)]" />
            <span className="flex-1 text-left text-[var(--deep-forest)]">Change Alerts</span>
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
