import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Alert {
  id: string;
  device_id: string;
  type_alert: 'Inactivity Detected' | 'Out of Range' | 'Low Battery';
  active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  device?: {
    id: string;
    animal_name?: string;
    tracker_id: string;
  };
}

export const useAlerts = (userId?: string, activeOnly: boolean = true) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      let query = supabase
        .from('alerts')
        .select(`
          *,
          device:devices!alerts_device_id_fkey (
            id,
            animal_name,
            tracker_id
          )
        `)
        .order('created_at', { ascending: false });

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Filter alerts to only those belonging to user's devices
      const userAlerts = (data || []).filter((alert: any) => {
        // The device join should already be filtered by RLS, but double-check
        return alert.device;
      });

      setAlerts(userAlerts as Alert[]);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Set up real-time subscription
    const channel = supabase
      .channel('alerts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeOnly]);

  return { alerts, loading, error, refetch: fetchAlerts };
};
