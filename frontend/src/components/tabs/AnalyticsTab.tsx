import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const AnalyticsTab: React.FC = () => {
  const { devices, alerts } = useApp();
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Generate mock movement data for chart
  const generateMockData = () => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      distance: Math.random() * 2,
    }));
  };

  const toggleDevice = (deviceId: string) => {
    setExpandedDevice(expandedDevice === deviceId ? null : deviceId);
  };

  // Calculate herd statistics
  const totalActive = devices.filter((d) => d.activeTime > 0).length;
  const totalInactive = devices.length - totalActive;
  const activePercentage = devices.length > 0 ? Math.round((totalActive / devices.length) * 100) : 0;
  const todayAlerts = alerts.filter(
    (a) => new Date(a.timestamp).toDateString() === new Date().toDateString()
  ).length;

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
                {totalActive} ({activePercentage}%)
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Inactive Animals</p>
              <p className="text-[var(--deep-forest)]">
                {totalInactive} ({100 - activePercentage}%)
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 col-span-2">
              <p className="text-sm text-gray-600">Alerts Today</p>
              <p className="text-[var(--deep-forest)]">{todayAlerts}</p>
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
                    <h4 className="text-[var(--deep-forest)]">{device.animalName}</h4>
                    <p className="text-sm text-gray-600">ID: {device.id}</p>
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
                      <p className="text-[var(--deep-forest)]">{device.speed.toFixed(1)} km/h</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Distance Today</p>
                      <p className="text-[var(--deep-forest)]">{device.distanceToday.toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active Time</p>
                      <p className="text-[var(--deep-forest)]">{device.activeTime} min</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Inactive Time</p>
                      <p className="text-[var(--deep-forest)]">{device.inactiveTime} min</p>
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
                        <p className="text-[var(--deep-forest)]">{device.speed.toFixed(1)} km/h</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Active Time</p>
                        <p className="text-[var(--deep-forest)]">{device.activeTime} min</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">Inactive Time</p>
                        <p className="text-[var(--deep-forest)]">{device.inactiveTime} min</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                        <p className="text-sm text-gray-600">Total Distance</p>
                        <p className="text-[var(--deep-forest)]">{device.distanceToday.toFixed(2)} km</p>
                      </div>
                    </div>

                    {/* Timeline Chart */}
                    <div>
                      <h4 className="text-[var(--deep-forest)] mb-2">Movement Timeline</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={generateMockData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="distance"
                              stroke="#78A64A"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Average Distance */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">Average Distance Travelled</p>
                      <p className="text-[var(--deep-forest)]">
                        {(device.distanceToday * 0.9).toFixed(2)} km
                      </p>
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
