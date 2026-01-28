import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDevices } from '../../hooks/useDevices';
import { useAlerts } from '../../hooks/useAlerts';
import { CheckCircle2, AlertTriangle, Clock, Smartphone, ChevronRight } from 'lucide-react';
import { useGeofences } from '../../hooks/useGeofences';
import { useLiveLocations } from '../../hooks/useLiveLocations';
import welcomeImage from '../../assets/20250621-P1300259-2-3.jpg';

export const HomeTab: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { devices } = useDevices(user?.id);
  const { alerts } = useAlerts(user?.id, true);
  const { geofences } = useGeofences(user?.id);
  const { locations } = useLiveLocations(user?.id, 5000);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate counts according to requirements:
  // - Active Alerts: count of alerts where active = true
  // - Animals Outside: count of devices that are active (green/red markers) AND have active alert (red markers)
  //   i.e. live_location_active = true AND has_active_alert = true
  // - Animals Inside: count of devices that are active (green markers) AND have no active alert
  //   i.e. live_location_active = true AND has_active_alert = false
  // - Active Geofences: number of geofences rows for this user_id
  // - Devices Inactive: number of trackers shown as inactive (grey marker),
  //   i.e. live_location_active = false (updated_at older than threshold)
  const counts = useMemo(() => {
    const activeAlertsCount = alerts.filter((a) => a.active).length;
    const activeGeofences = geofences.length;

    // Compute counts based on live_locations, same rules as MapTab markers
    const now = new Date();
    let animalsOutside = 0; // Active AND has alert (red markers)
    let animalsInside = 0; // Active AND no alert (green markers)
    let inactiveDevices = 0; // Inactive (grey markers)

    locations.forEach((location) => {
      const updatedAt = new Date(location.updated_at);
      const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;
      const live_location_active = secondsSinceUpdate <= 30;

      // Check if this tracker has any active alerts
      const hasActiveAlert = alerts.some(
        (a) => a.active && a.device?.tracker_id === location.tracker_id
      );

      if (live_location_active) {
        if (hasActiveAlert) {
          // Red marker: active but has alert (out of zone)
          animalsOutside += 1;
        } else {
          // Green marker: active and no alert (inside zone)
          animalsInside += 1;
        }
      } else {
        // Grey marker: inactive
        inactiveDevices += 1;
      }
    });

    return {
      activeAlerts: activeAlertsCount,
      animalsOutside,
      animalsInside,
      activeGeofences,
      inactiveDevices,
    };
  }, [devices, alerts, geofences, locations]);

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
        {/* Manage Devices - Moved to top */}
        <button
          onClick={() => navigate('/link-devices?mode=edit', {
            state: {
              mode: 'edit',
              from: { pathname: '/main', mainTab: 'home' }
            }
          })}
          className="w-full bg-white/90 backdrop-blur-sm rounded-2xl p-5 hover:bg-white transition-colors active:bg-white/95"
        >
          <div className="flex items-center justify-center gap-3">
            <Smartphone className="w-6 h-6 text-[var(--accent-aqua)]" />
            <h4 className="text-[var(--deep-forest)] text-[22px]">Manage Devices</h4>
          </div>
        </button>
        
        {/* Active Alerts */}
        <div
          className={[
            'bg-white/90 backdrop-blur-sm rounded-2xl p-5 transition-shadow transition-transform',
            counts.activeAlerts > 0
              ? 'border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.55)] animate-pulse'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-[var(--deep-forest)] text-[22px]">Active Alerts</h3>
          </div>
          <p className="text-center">
            <span className="text-[56px] font-black text-[var(--deep-forest)]" style={{ 
              letterSpacing: '-0.02em',
              textShadow: '0 4px 12px rgba(239, 68, 68, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
              filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.3))'
            }}>
              {counts.activeAlerts}
            </span>
          </p>
          {counts.activeAlerts > 0 && (
            <p className="text-[18px] text-red-600 mt-1 text-center">
              Requires your attention
            </p>
          )}
        </div>

        {/* Compact 2×2 Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Inside */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 flex flex-col items-center justify-center min-h-[100px]">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--grass-green)]" />
              <h4 className="text-[var(--deep-forest)] text-[22px] font-medium">Inside</h4>
            </div>
            <p className="text-[48px] font-black text-[var(--deep-forest)] my-2" style={{ 
              letterSpacing: '-0.02em',
              textShadow: '0 4px 12px rgba(120, 166, 74, 0.35), 0 2px 4px rgba(0, 0, 0, 0.2)',
              filter: 'drop-shadow(0 0 6px rgba(120, 166, 74, 0.25))'
            }}>
              {counts.animalsInside}
            </p>
            <p className="text-[var(--deep-forest)] text-[18px] text-center">Animals</p>
          </div>
          {/* Outside */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 flex flex-col items-center justify-center min-h-[100px]">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <h4 className="text-[var(--deep-forest)] text-[22px] font-medium">Outside</h4>
            </div>
            <p className="text-[30px] font-black bg-gradient-to-br from-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-md my-2" style={{ letterSpacing: '0.1em', textShadow: '0 2px 8px rgba(249, 115, 22, 0.3)' }}>
              {counts.animalsOutside}
            </p>
            <p className="text-[var(--deep-forest)] text-[18px] text-center">Animals</p>
          </div>
          {/* Inactive */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 flex flex-col items-center justify-center min-h-[100px]">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-gray-500" />
              <h4 className="text-[var(--deep-forest)] text-[22px] font-medium">Inactive</h4>
            </div>
            <p className="text-[48px] font-black text-[var(--deep-forest)] my-2" style={{ 
              letterSpacing: '-0.02em',
              textShadow: '0 4px 12px rgba(107, 114, 128, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)',
              filter: 'drop-shadow(0 0 6px rgba(107, 114, 128, 0.2))'
            }}>
              {counts.inactiveDevices}
            </p>
            <p className="text-[var(--deep-forest)] text-[18px] text-center">Devices</p>
          </div>
          {/* Zones */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-3 flex flex-col items-center justify-center min-h-[100px]">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-aqua)]" />
              <h4 className="text-[var(--deep-forest)] text-[22px] font-medium">Zones</h4>
            </div>
            <p className="text-[30px] font-black bg-gradient-to-br from-[var(--accent-aqua)] to-cyan-600 bg-clip-text text-transparent drop-shadow-md my-2" style={{ letterSpacing: '0.1em', textShadow: '0 2px 8px rgba(34, 211, 238, 0.3)' }}>
              {counts.activeGeofences}
            </p>
            <p className="text-[var(--deep-forest)] text-[18px] text-center">Active</p>
          </div>
        </div>

        {/* Last Update */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-[var(--accent-aqua)]" />
            <h3 className="text-[var(--deep-forest)] text-[22px]">Last Update</h3>
          </div>
          <p className="text-center">
            <span className="text-[48px] font-black text-[var(--deep-forest)]" style={{ 
              letterSpacing: '-0.02em',
              textShadow: '0 4px 12px rgba(34, 211, 238, 0.35), 0 2px 4px rgba(0, 0, 0, 0.2)',
              filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.25))'
            }}>
              {formatTime(lastUpdate)}
            </span>
          </p>
          <p className="text-[18px] text-gray-600 mt-1 text-center">
            System is monitoring your herd
          </p>
        </div>

 


      </div>
    </div>
  );
};
