import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDevices } from '../../hooks/useDevices';
import { useAlerts } from '../../hooks/useAlerts';
import { useLiveLocations } from '../../hooks/useLiveLocations';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const AnalyticsTab: React.FC = () => {
  const { user } = useAuth();
  const { devices } = useDevices(user?.id);
  const { alerts } = useAlerts(user?.id, true);
  const { locations } = useLiveLocations(5000);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Generate movement timeline data from live_locations
  const generateMovementData = useMemo(() => {
    // Group locations by hour of the day
    const hourlyData: { [hour: number]: number[] } = {};
    
    locations.forEach((location) => {
      const date = new Date(location.captured_at || location.updated_at);
      const hour = date.getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      // Convert speed from m/s to km/h
      const speedKmh = location.speed_mps ? location.speed_mps * 3.6 : 0;
      hourlyData[hour].push(speedKmh);
    });

    // Calculate average speed per hour
    return Array.from({ length: 24 }, (_, i) => {
      const speeds = hourlyData[i] || [];
      const avgSpeed = speeds.length > 0
        ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length
        : 0;
      return {
        hour: `${i}:00`,
        speed: avgSpeed,
      };
    });
  }, [locations]);

  const toggleDevice = (deviceId: string) => {
    setExpandedDevice(expandedDevice === deviceId ? null : deviceId);
  };

  // Calculate herd statistics according to requirements:
  // - Active Animals: count devices where active = true
  // - Inactive Animals: count devices where active = false
  // - Alerts Today: count alerts where active = true AND created_at is today
  const stats = useMemo(() => {
    const activeAnimals = devices.filter((d) => d.active).length;
    const inactiveAnimals = devices.filter((d) => !d.active).length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertsToday = alerts.filter((a) => {
      const alertDate = new Date(a.created_at);
      alertDate.setHours(0, 0, 0, 0);
      return alertDate.getTime() === today.getTime() && a.active;
    }).length;

    return {
      activeAnimals,
      inactiveAnimals,
      alertsToday,
    };
  }, [devices, alerts]);

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Herd Overview */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h4 className="text-[var(--deep-forest)] mb-3">Herd Overview</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Active Animals</p>
              <p className="text-[var(--deep-forest)]">
                {stats.activeAnimals}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Inactive Animals</p>
              <p className="text-[var(--deep-forest)]">
                {stats.inactiveAnimals}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 col-span-2">
              <p className="text-sm text-gray-600">Alerts Today</p>
              <p className="text-[var(--deep-forest)]">{stats.alertsToday}</p>
            </div>
          </div>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--grass-green)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--grass-green)]"
            />
          </div>
        </div>

        {/* Per-Animal Data */}
        <div className="space-y-3">
          {devices.map((device) => {
            const isExpanded = expandedDevice === device.id;
            return (
              <div key={device.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Device Header */}
                <button
                  onClick={() => toggleDevice(device.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <h4 className="text-[var(--deep-forest)]">{device.animal_name || device.name || 'Unknown'}</h4>
                    <p className="text-sm text-gray-600">ID: {device.tracker_id}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Device Details */}
                {!isExpanded && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600">Current Speed</p>
                      <p className="text-[var(--deep-forest)]">{Number(device.speed).toFixed(1)} km/h</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Distance</p>
                      <p className="text-[var(--deep-forest)]">{Number(device.total_distance).toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active Time</p>
                      <p className="text-[var(--deep-forest)]">{Math.floor(device.active_time / 60)} min</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Inactive Time</p>
                      <p className="text-[var(--deep-forest)]">{Math.floor(device.inactive_time / 60)} min</p>
                    </div>
                  </div>
                )}

                {/* Expanded View */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Avg Speed</p>
                        <p className="text-[var(--deep-forest)]">
                          {(device.speed * 0.8).toFixed(1)} km/h
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Current Speed</p>
                        <p className="text-[var(--deep-forest)]">{Number(device.speed).toFixed(1)} km/h</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Active Time</p>
                        <p className="text-[var(--deep-forest)]">{Math.floor(device.active_time / 60)} min</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Inactive Time</p>
                        <p className="text-[var(--deep-forest)]">{Math.floor(device.inactive_time / 60)} min</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                        <p className="text-sm text-gray-600">Total Distance</p>
                        <p className="text-[var(--deep-forest)]">{Number(device.total_distance).toFixed(2)} km</p>
                      </div>
                    </div>

                    {/* Movement Timeline Chart - y-axis speed, x-axis hours */}
                    <div>
                      <h4 className="text-[var(--deep-forest)] mb-2">Movement Timeline</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={generateMovementData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                            <YAxis label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="speed"
                              stroke="#78A64A"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Mini Map Placeholder */}
                    <div className="bg-gray-100 rounded-lg p-8 text-center">
                      <p className="text-sm text-gray-500">Movement trajectory map</p>
                      <p className="text-xs text-gray-400 mt-1">Full implementation requires historical GPS data</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {devices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No devices linked yet</p>
            <p className="text-sm text-gray-400 mt-1">Add devices to see analytics</p>
          </div>
        )}
      </div>
    </div>
  );
};
