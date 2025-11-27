import React, { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export const HomeTab: React.FC = () => {
  const { devices, alerts } = useApp();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const insideCount = devices.filter((d) => d.status === 'inside').length;
  const outsideCount = devices.filter((d) => d.status !== 'inside').length;
  const activeAlertsCount = alerts.filter((a) => !a.resolved).length;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full green-gradient-bg p-4 overflow-y-auto">
      <div className="space-y-4 max-w-md mx-auto">
        {/* Summary Cards */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-[var(--grass-green)]" />
            <h3 className="text-[var(--deep-forest)]">Animals Inside</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{insideCount} animals</p>
          <p className="text-sm text-gray-600 mt-1">
            All animals are within the safe zone
          </p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-[var(--deep-forest)]">Animals Outside</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{outsideCount} animals</p>
          {outsideCount > 0 && (
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
          <p className="text-[var(--deep-forest)]">{activeAlertsCount} alerts</p>
          {activeAlertsCount > 0 && (
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
                {devices.length > 0
                  ? Math.round(
                      devices.reduce((acc, d) => acc + d.batteryLevel, 0) / devices.length
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
