import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Alert {
  id: string;
  device_id: string;
  // Include DB-driven 'out' / 'out_of_zone' types in addition to existing ones
  type_alert: 'Inactivity Detected' | 'Out of Range' | 'Low Battery' | 'out' | 'out_of_zone';
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
      setAlerts([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      let query = supabase
        .from('alerts')
        .select(
          `
          *,
          device:devices!alerts_device_id_fkey (
            id,
            animal_name,
            tracker_id
          )
        `
        )
        // Security: explicitly scope by user_id (defense in depth; RLS also applies)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setAlerts((data || []) as Alert[]);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAlerts();

    if (!userId) {
      return;
    }

    // Set up real-time subscription scoped to this user's alerts.
    // Realtime still respects RLS; the filter reduces noisy events.
    const channel = supabase
      .channel('alerts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Re-fetch whenever any alert row for this user changes
          fetchAlerts();
        }
      )
      .subscribe();

    // Fallback polling: ensure UI updates even if Realtime is not configured
    const intervalId = window.setInterval(() => {
      fetchAlerts();
    }, 10000); // every 10 seconds

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(intervalId);
    };
  }, [userId, activeOnly]);

  const deleteAlert = async (id: string, ownerId?: string) => {
    // ownerId is passed for explicit defense-in-depth filtering
    if (!ownerId) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId);

    if (deleteError) {
      throw deleteError;
    }

    // Optimistically update local state
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return { alerts, loading, error, refetch: fetchAlerts, deleteAlert };
};
