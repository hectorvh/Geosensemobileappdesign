import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDevices } from '../../hooks/useDevices';
import { useAlerts } from '../../hooks/useAlerts';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import welcomeImage from '../../assets/20250621-P1300259-2-3.jpg';

export const HomeTab: React.FC = () => {
  const { user } = useAuth();
  const { devices } = useDevices(user?.id);
  const { alerts } = useAlerts(user?.id, true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate counts according to requirements:
  // - Active Alerts: count of alerts where active = true
  // - Animals Outside: count of devices where animal_outside = true AND active = true
  // - Animals Inside: count of devices where animal_outside = false AND active = true
  const counts = useMemo(() => {
    const activeAlertsCount = alerts.filter((a) => a.active).length;
    const animalsOutside = devices.filter((d) => d.animal_outside && d.active).length;
    const animalsInside = devices.filter((d) => !d.animal_outside && d.active).length;
    
    return {
      activeAlerts: activeAlertsCount,
      animalsOutside,
      animalsInside,
    };
  }, [devices, alerts]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full green-gradient-bg p-4 overflow-y-auto">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: `url(${welcomeImage})`
        }}
      />
      <div className="space-y-4 max-w-md mx-auto">
        {/* Summary Cards */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-[var(--grass-green)]" />
            <h3 className="text-[var(--deep-forest)]">Animals Inside</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{counts.animalsInside} animals</p>
          <p className="text-sm text-gray-600 mt-1">
            All animals are within the safe zone
          </p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-[var(--deep-forest)]">Animals Outside</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{counts.animalsOutside} animals</p>
          {counts.animalsOutside > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              Check map for details
            </p>
          )}
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-[var(--deep-forest)]">Active Alerts</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{counts.activeAlerts} alerts</p>
          {counts.activeAlerts > 0 && (
            <p className="text-sm text-red-600 mt-1">
              Requires your attention
            </p>
          )}
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-[var(--accent-aqua)]" />
            <h3 className="text-[var(--deep-forest)]">Last Update</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{formatTime(lastUpdate)}</p>
          <p className="text-sm text-gray-600 mt-1">
            System is monitoring your herd
          </p>
        </div>

        {/* Quick Stats */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <h4 className="text-[var(--deep-forest)] mb-3">Quick Stats</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Animals:</span>
              <span className="text-[var(--deep-forest)]">{devices.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active Geofences:</span>
              <span className="text-[var(--deep-forest)]">1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Battery Average:</span>
              <span className="text-[var(--deep-forest)]">
                {devices.length > 0 && devices.some(d => d.battery_level)
                  ? Math.round(
                      devices
                        .filter(d => d.battery_level)
                        .reduce((acc, d) => acc + (d.battery_level || 0), 0) / 
                      devices.filter(d => d.battery_level).length
                    )
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
