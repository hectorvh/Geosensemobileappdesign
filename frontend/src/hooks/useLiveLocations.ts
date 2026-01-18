import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface LiveLocation {
  tracker_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
  captured_at: string;
  updated_at: string;
  is_high_accuracy: boolean | null;
}

export const useLiveLocations = (pollInterval: number = 5000) => {
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('live_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setLocations(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching live locations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLocations();

    // Set up polling
    const interval = setInterval(fetchLocations, pollInterval);

    // Set up real-time subscription
    const channel = supabase
      .channel('live_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
        },
        () => {
          // Refetch when changes occur
          fetchLocations();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pollInterval]);

  return { locations, loading, error, refetch: fetchLocations };
};
