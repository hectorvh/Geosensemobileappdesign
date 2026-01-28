import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Geofence {
  id: number;
  name: string;
  user_id: string;
  // Supabase/PostGIS geometry(MultiPolygon, 4326) is serialized as GeoJSON.
  // We accept either Polygon or MultiPolygon in the API response.
  boundary_inner: {
    type: 'Polygon' | 'MultiPolygon';
    // Polygon:        number[][][]      ( [ [ [lng,lat], ... ] ] )
    // MultiPolygon:   number[][][][]    ( [ [ [ [lng,lat], ... ] ], ... ] )
    coordinates: number[][][] | number[][][][];
  };
  boundary_outer?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
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
      
      // SECURITY: Always require userId - do not fetch geofences without user context
      if (!userId) {
        setGeofences([]);
        setLoading(false);
        return;
      }

      // SECURITY: Explicitly filter by user_id (defense in depth - RLS also enforces this)
      const { data, error: fetchError } = await supabase
        .from('geofences')
        .select('*')
        .eq('user_id', userId) // Explicit user filter - required
        .order('created_at', { ascending: false });

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
    // SECURITY: Filter subscription by user_id to only receive changes for current user's geofences
    const channel = supabase
      .channel('geofences_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'geofences',
          filter: userId ? `user_id=eq.${userId}` : undefined, // Filter by user_id
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
