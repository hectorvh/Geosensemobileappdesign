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
          onClick={() => navigate('/link-devices')}
          className="w-full bg-white/90 backdrop-blur-sm rounded-2xl p-5 text-left hover:bg-white transition-colors active:bg-white/95"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6 text-[var(--accent-aqua)]" />
              <h4 className="text-[var(--deep-forest)]">Manage Devices</h4>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
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

        {/* Animals Inside */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-[var(--grass-green)]" />
            <h3 className="text-[var(--deep-forest)]">Animals Inside</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{counts.animalsInside} animals</p>
        </div>

        {/* Animals Outside */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-[var(--deep-forest)]">Animals Outside</h3>
          </div>
          <p className="text-[var(--deep-forest)]">{counts.animalsOutside} Animals</p>
          {counts.animalsOutside > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              Check map for details
            </p>
          )}
        </div>

        {/* Devices Inactive (grey markers) */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-gray-500" />
            <h3 className="text-[var(--deep-forest)]">Devices Inactive</h3>
          </div>
          <p className="text-[var(--deep-forest)]">
            {counts.inactiveDevices} Devices without recent location updates
          </p>
        </div>

        {/* Active Zones */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-[var(--accent-aqua)]" />
            <h3 className="text-[var(--deep-forest)]">Active Zones</h3>
          </div>
          <p className="text-[var(--deep-forest)]">
            {counts.activeGeofences} Zones currently defined for your herd
          </p>
        </div>

        {/* Last Update */}
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

 


      </div>
    </div>
  );
};
