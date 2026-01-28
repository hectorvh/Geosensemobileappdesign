import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAlerts, Alert } from '../../hooks/useAlerts';
import {
  AlertTriangle,
  Battery,
  Activity,
  Clock,
  Bell,
  ChevronRight,
  Trash2,
} from 'lucide-react';

export const AlertsTab: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { alerts, loading, error, deleteAlert } = useAlerts(user?.id, true);

  const getAlertIcon = (type: Alert['type_alert']) => {
    switch (type) {
      case 'Out of Range':
      case 'out':
      case 'out_of_zone':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'Low Battery':
        return <Battery className="w-5 h-5 text-orange-500" />;
      case 'Inactivity Detected':
        return <Activity className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getAlertTitle = (type: Alert['type_alert']) => {
    switch (type) {
      case 'out':
      case 'out_of_zone':
        return 'Out of Range';
      default:
        return type;
    }
  };

  const getAlertDescription = (type: Alert['type_alert']) => {
    switch (type) {
      case 'Out of Range':
      case 'out':
      case 'out_of_zone':
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

  const handleDelete = async (alert: Alert) => {
    if (!user?.id) return;

    const confirmed = window.confirm('Are you sure you want to delete this alert?');
    if (!confirmed) return;

    try {
      await deleteAlert(alert.id, user.id);
    } catch (err) {
      console.error('Failed to delete alert:', err);
      // Simple inline fallback; you can swap for a toast if the project uses one
      window.alert('Failed to delete alert. Please try again.');
    }
  };

  const handleSetAlertsClick = () => {
    console.log('Set Alerts clicked'); // Debug log
    navigate('/customize-alerts');
  };

  return (
    <div className="h-full bg-gray-50 overflow-y-auto relative">
      <div className="p-4 space-y-3 relative z-10">
        {/* Set Alerts Box - Rebuilt for reliability */}
        <button
          type="button"
          onClick={handleSetAlertsClick}
          className="w-full bg-white rounded-lg p-4 text-left hover:bg-gray-50 transition-colors active:bg-gray-100 shadow-sm relative z-10 pointer-events-auto cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-[var(--accent-aqua)]" />
              <h4 className="text-[var(--deep-forest)]">Set Alerts</h4>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
        {loading ? (
          <div className="h-full flex items-center justify-center py-12">
            <p className="text-gray-500">Loading alerts...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">Failed to load alerts.</p>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
          </div>
        ) : alerts.length === 0 ? (
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
                    <div>
                      <h4 className="text-[var(--deep-forest)]">
                        {getAlertTitle(alert.type_alert)}
                      </h4>
                      {!alert.active && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{getTimeSince(new Date(alert.created_at))}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(alert)}
                        className="p-1 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                        aria-label="Delete alert"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {getAlertDescription(alert.type_alert)}
                  </p>
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
