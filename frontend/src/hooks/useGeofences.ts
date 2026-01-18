import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Geofence {
  id: number;
  name: string;
  user_id: string;
  boundary_inner: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  boundary_outer?: {
    type: 'Polygon';
    coordinates: number[][][];
  } | null;
  buffer_m: number;
  created_at: string;
  updated_at: string;
}

export const useGeofences = (userId?: string) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGeofences = async () => {
    try {
      setError(null);
      let query = supabase
        .from('geofences')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by user_id if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setGeofences(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching geofences:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch geofences');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchGeofences();

    // Set up real-time subscription
    const channel = supabase
      .channel('geofences_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'geofences',
        },
        () => {
          // Refetch when changes occur
          fetchGeofences();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { geofences, loading, error, refetch: fetchGeofences };
};
