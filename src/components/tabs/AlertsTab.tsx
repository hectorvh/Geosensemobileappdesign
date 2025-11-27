import React, { useEffect } from 'react';
import { useApp, Alert } from '../../contexts/AppContext';
import { AlertTriangle, Battery, Activity, Clock } from 'lucide-react';

export const AlertsTab: React.FC = () => {
  const { devices, alerts, setAlerts, alertSettings } = useApp();

  // Generate mock alerts based on device status and settings
  useEffect(() => {
    const newAlerts: Alert[] = [];

    devices.forEach((device) => {
      // Out of range alert
      if (alertSettings.outOfRange && device.status === 'outside-alert') {
        newAlerts.push({
          id: `${device.id}-outofrange`,
          deviceId: device.id,
          animalName: device.animalName,
          type: 'out-of-range',
          timestamp: new Date(Date.now() - Math.random() * 3600000),
          resolved: false,
        });
      }

      // Low battery alert
      if (alertSettings.lowBattery && device.batteryLevel < 15) {
        newAlerts.push({
          id: `${device.id}-battery`,
          deviceId: device.id,
          animalName: device.animalName,
          type: 'low-battery',
          timestamp: new Date(Date.now() - Math.random() * 3600000),
          resolved: false,
        });
      }

      // Inactivity alert
      if (alertSettings.inactivity && device.inactiveTime > 15) {
        newAlerts.push({
          id: `${device.id}-inactive`,
          deviceId: device.id,
          animalName: device.animalName,
          type: 'inactivity',
          timestamp: new Date(Date.now() - Math.random() * 3600000),
          resolved: false,
        });
      }
    });

    if (JSON.stringify(newAlerts) !== JSON.stringify(alerts)) {
      setAlerts(newAlerts);
    }
  }, [devices, alertSettings]);

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'out-of-range':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'low-battery':
        return <Battery className="w-5 h-5 text-orange-500" />;
      case 'inactivity':
        return <Activity className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getAlertTitle = (type: Alert['type']) => {
    switch (type) {
      case 'out-of-range':
        return 'Out of Range';
      case 'low-battery':
        return 'Low Battery';
      case 'inactivity':
        return 'Inactivity Detected';
    }
  };

  const getAlertDescription = (type: Alert['type']) => {
    switch (type) {
      case 'out-of-range':
        return 'Animal has left the geofence area';
      case 'low-battery':
        return 'Device battery is below 15%';
      case 'inactivity':
        return 'No movement detected for over 15 minutes';
    }
  };

  const getTimeSince = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      <div className="p-4 space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No active alerts</p>
            <p className="text-sm text-gray-400 mt-1">Your herd is safe</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-1">{getAlertIcon(alert.type)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-[var(--deep-forest)]">{getAlertTitle(alert.type)}</h4>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeSince(alert.timestamp)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{getAlertDescription(alert.type)}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Animal:</span>
                    <span className="text-[var(--deep-forest)]">{alert.animalName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Device ID:</span>
                    <span className="text-[var(--deep-forest)]">{alert.deviceId}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
