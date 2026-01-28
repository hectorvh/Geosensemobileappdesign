import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Map as MapIcon, Bell, BarChart3, Settings } from 'lucide-react';
import { HomeTab } from '../components/tabs/HomeTab';
import { MapTab } from '../components/tabs/MapTab';
import { AlertsTab } from '../components/tabs/AlertsTab';
import { AnalyticsTab } from '../components/tabs/AnalyticsTab';
import { useApp } from '../contexts/AppContext';

export const MainApp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeMainTab, setActiveMainTab, setLastRoute, setLastMainTab } = useApp();

  // Restore tab from navigation state if provided
  React.useEffect(() => {
    const state = location.state as { restoreTab?: string } | null;
    if (state?.restoreTab && ['home', 'map', 'alerts', 'analytics'].includes(state.restoreTab)) {
      setActiveMainTab(state.restoreTab as any);
    }
  }, [location.state, setActiveMainTab]);

  // Track navigation state when tab changes
  React.useEffect(() => {
    setLastRoute('/main');
    setLastMainTab(activeMainTab);
  }, [activeMainTab, setLastRoute, setLastMainTab]);

  // Track when navigating away from /main
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      setLastRoute('/main');
      setLastMainTab(activeMainTab);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeMainTab, setLastRoute, setLastMainTab]);

  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'map' as const, icon: MapIcon, label: 'Map' },
    { id: 'alerts' as const, icon: Bell, label: 'Alerts' },
    { id: 'analytics' as const, icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <div className="mobile-screen flex flex-col">
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 flex items-center justify-between shrink-0 relative">
        <h2
          className="mb-2"
          style={{ fontWeight: 700, fontSize: '1.4rem' }}
        >
          GeoSense
        </h2>
        <button
          onClick={() => navigate('/settings', {
            state: {
              from: { pathname: '/main', mainTab: activeMainTab }
            }
          })}
          className="p-2 hover:bg-[var(--pine-green)] rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeMainTab === 'home' && <HomeTab />}
        {activeMainTab === 'map' && <MapTab />}
        {activeMainTab === 'alerts' && <AlertsTab />}
        {activeMainTab === 'analytics' && <AnalyticsTab />}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="bg-white border-t border-gray-200 shrink-0 relative">
        <div className="flex items-center justify-around p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMainTab(tab.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-[var(--grass-green)]'
                    : 'text-gray-500 hover:text-[var(--pine-green)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
