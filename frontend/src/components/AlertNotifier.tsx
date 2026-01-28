import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../contexts/AppContext';
import { AlertTriangle, Battery, Activity, Clock, X } from 'lucide-react';

type RawAlert = {
  id: string;
  user_id: string;
  device_id: string;
  type_alert: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const AUTO_DISMISS_MS = 5000;
const DEDUPE_WINDOW_MS = 10000;

export const AlertNotifier: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveMainTab } = useApp();

  const [current, setCurrent] = useState<RawAlert | null>(null);
  const queueRef = useRef<RawAlert[]>([]);
  const showingRef = useRef(false);
  const lastShownRef = useRef<Record<string, number>>({});
  const timeoutRef = useRef<number | null>(null);

  const isOnAlertsTab = location.pathname === '/main';

  const getIcon = (type: string) => {
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

  const getTitle = (type: string) => {
    switch (type) {
      case 'out':
      case 'out_of_zone':
        return 'Out of Range';
      default:
        return type || 'Alert';
    }
  };

  const getDescription = (type: string) => {
    switch (type) {
      case 'Out of Range':
      case 'out':
      case 'out_of_zone':
        return 'Animal has left the geofence area';
      case 'Low Battery':
        return 'Device battery is below 15%';
      case 'Inactivity Detected':
        return 'No movement detected for over 15 minutes';
      default:
        return 'New alert from GeoSense';
    }
  };

  const getTimeSince = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const showNext = () => {
    const next = queueRef.current.shift() || null;
    if (!next) {
      showingRef.current = false;
      setCurrent(null);
      return;
    }
    showingRef.current = true;
    setCurrent(next);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      showingRef.current = false;
      setCurrent(null);
      showNext();
    }, AUTO_DISMISS_MS);
  };

  const enqueueAlert = (alert: RawAlert) => {
    if (!alert.id) return;
    if (!alert.active) return; // only notify on active alerts

    // Only show popup for out-of-range style alerts
    const type = (alert.type_alert || '').toLowerCase();
    if (type !== 'out' && type !== 'out_of_zone') {
      return;
    }

    // Optional: suppress popups while user is already browsing Alerts tab
    if (isOnAlertsTab) return;

    const now = Date.now();
    const last = lastShownRef.current[alert.id];
    if (last && now - last < DEDUPE_WINDOW_MS) {
      return;
    }
    lastShownRef.current[alert.id] = now;

    queueRef.current.push(alert);
    if (!showingRef.current) {
      showNext();
    }
  };

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`global-alerts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload as any).new as RawAlert | null;
          if (!row) return;

          // Only react to INSERT/UPDATE, and only for this user (filter already enforces)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            enqueueAlert(row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      queueRef.current = [];
      showingRef.current = false;
      setCurrent(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOnAlertsTab]);

  if (!current) return null;

  const handleClick = () => {
    // Navigate to main app and switch to Alerts tab
    navigate('/main');
    setActiveMainTab('alerts');
    // Dismiss current and show next in queue
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    showingRef.current = false;
    setCurrent(null);
    showNext();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    showingRef.current = false;
    setCurrent(null);
    showNext();
  };

  return (
    <div className="fixed top-4 inset-x-0 flex justify-center z-50 pointer-events-none">
      <div className="max-w-sm w-full px-4">
        <button
          type="button"
          onClick={handleClick}
          className="w-full bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-start gap-3 pointer-events-auto text-left hover:bg-gray-50 transition-colors"
        >
          <div className="mt-1">{getIcon(current.type_alert)}</div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[var(--deep-forest)]">
                  {/* Fixed text per requirements */}
                  Alert: out of range
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  {getDescription(current.type_alert)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 flex-shrink-0"
                aria-label="Close alert notification"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-1 text-[0.7rem] text-gray-500 mt-1.5">
              <Clock className="w-3 h-3" />
              <span>{getTimeSince(current.created_at)}</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

