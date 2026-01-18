import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAlerts, Alert } from '../../hooks/useAlerts';
import { AlertTriangle, Battery, Activity, Clock } from 'lucide-react';
import welcomeImage from '../../assets/20250621-P1300259-2-3.jpg';

export const AlertsTab: React.FC = () => {
  const { user } = useAuth();
  const { alerts, loading } = useAlerts(user?.id, true);

  const getAlertIcon = (type: Alert['type_alert']) => {
    switch (type) {
      case 'Out of Range':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'Low Battery':
        return <Battery className="w-5 h-5 text-orange-500" />;
      case 'Inactivity Detected':
        return <Activity className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getAlertTitle = (type: Alert['type_alert']) => {
    return type;
  };

  const getAlertDescription = (type: Alert['type_alert']) => {
    switch (type) {
      case 'Out of Range':
        return 'Animal has left the geofence area';
      case 'Low Battery':
        return 'Device battery is below 15%';
      case 'Inactivity Detected':
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

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading alerts...</p>
      </div>
    );
  }

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
                <div className="shrink-0 mt-1">{getAlertIcon(alert.type_alert)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-[var(--deep-forest)]">{getAlertTitle(alert.type_alert)}</h4>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeSince(new Date(alert.created_at))}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{getAlertDescription(alert.type_alert)}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Animal:</span>
                    <span className="text-[var(--deep-forest)]">
                      {alert.device?.animal_name || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Device ID:</span>
                    <span className="text-[var(--deep-forest)]">
                      {alert.device?.tracker_id || alert.device_id}
                    </span>
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
