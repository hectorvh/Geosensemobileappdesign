import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useApp } from '../contexts/AppContext';
import { Switch } from '../components/ui/switch';
import { AlertTriangle, Battery, Activity } from 'lucide-react';
import backgroundImage from '@/assets/P1260790-2.jpg';

export const CustomizeAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { alertSettings, setAlertSettings } = useApp();

  return (
    <div className="mobile-screen flex flex-col bg-[var(--pine-green)] relative">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`
        }}
      />
      
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0 relative z-10">
        <h2
          className="mb-2"
          style={{ fontWeight: 700, fontSize: '1.4rem' }}
        >
          Customize Your Alerts
        </h2>
        <p className="text-sm opacity-90">Choose which notifications you want to receive</p>
      </div>

      {/* Alert Settings */}
      <div className="flex-1 p-4 space-y-4 relative z-10">
        {/* Out of Range */}
        <div className="bg-white/90 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-[var(--grass-green)]" />
                <h4 className="text-[var(--deep-forest)]">Out of Range</h4>
              </div>
              <p className="text-sm text-gray-600">
                Alert when tracker is outside fence for more than 30 seconds
              </p>
            </div>
            <Switch
              checked={alertSettings.outOfRange}
              onCheckedChange={(checked) =>
                setAlertSettings({ ...alertSettings, outOfRange: checked })
              }
            />
          </div>
        </div>

        {/* Low Battery */}
        <div className="bg-white/90 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Battery className="w-5 h-5 text-[var(--accent-aqua)]" />
                <h4 className="text-[var(--deep-forest)]">Low Battery</h4>
              </div>
              <p className="text-sm text-gray-600">
                Alert when battery level drops below 15%
              </p>
            </div>
            <Switch
              checked={alertSettings.lowBattery}
              onCheckedChange={(checked) =>
                setAlertSettings({ ...alertSettings, lowBattery: checked })
              }
            />
          </div>
        </div>

        {/* Inactivity */}
        <div className="bg-white/90 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-[var(--high-yellow)]" />
                <h4 className="text-[var(--deep-forest)]">Inactivity</h4>
              </div>
              <p className="text-sm text-gray-600">
                Alert when no movement detected for 15 minutes
              </p>
            </div>
            <Switch
              checked={alertSettings.inactivity}
              onCheckedChange={(checked) =>
                setAlertSettings({ ...alertSettings, inactivity: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0 relative z-10">
        <div className="flex gap-2">
          <GeoButton 
            variant="outline" 
            onClick={() => navigate('/link-devices')}
            className="flex-1"
          >
            Back
          </GeoButton>
          <GeoButton 
            variant="primary" 
            onClick={() => navigate('/main')}
            className="flex-1"
          >
            Next
          </GeoButton>
        </div>
      </div>
    </div>
  );
};