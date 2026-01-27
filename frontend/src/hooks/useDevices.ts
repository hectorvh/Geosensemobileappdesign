import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Device {
  id: string;
  tracker_id: string;
  user_id: string;
  name?: string;
  animal_name?: string;
  age?: number;
  weight?: number;
  batch_id?: string;
  last_update?: string;
  animal_outside: boolean;
  active: boolean;
  speed: number;
  active_time: number; // seconds
  inactive_time: number; // seconds
  total_distance: number; // km
  battery_level?: number;
  created_at: string;
  updated_at: string;
}

export const useDevices = (userId?: string) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setDevices(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    // Set up real-time subscription
    const channel = supabase
      .channel('devices_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: userId ? `user_id=eq.${userId}` : undefined,
        },
        () => {
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { devices, loading, error, refetch: fetchDevices };
};
