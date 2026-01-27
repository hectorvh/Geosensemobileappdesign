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

export const useLiveLocations = (userId?: string, pollInterval: number = 5000) => {
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = async () => {
    try {
      setError(null);
      
      // SECURITY: Always require userId - do not fetch locations without user context
      if (!userId) {
        setLocations([]);
        setLoading(false);
        return;
      }

      // SECURITY: Use the secure view that automatically filters by user's linked devices
      // RLS on live_locations will also enforce this, but using the view is cleaner
      // If view doesn't exist yet, fall back to direct query (RLS will enforce)
      let queryData: LiveLocation[] | null = null;
      
      try {
        const { data, error: fetchError } = await supabase
          .from('user_live_locations')
          .select('tracker_id, lat, lng, accuracy_m, speed_mps, heading_deg, altitude_m, captured_at, updated_at, is_high_accuracy')
          .order('updated_at', { ascending: false });
        
        if (fetchError) {
          throw fetchError;
        }
        queryData = data;
      } catch (viewError: any) {
        // If view doesn't exist (code 42P01) or other error, fall back to direct query
        // RLS will still enforce security - users can only see locations for linked trackers
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('live_locations')
          .select('*')
          .order('updated_at', { ascending: false });

        if (fallbackError) {
          throw fallbackError;
        }
        queryData = fallbackData;
      }
      
      setLocations(queryData || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching live locations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if userId is provided
    if (!userId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchLocations();

    // Set up polling
    const interval = setInterval(fetchLocations, pollInterval);

    // Set up real-time subscription
    // SECURITY: RLS will automatically filter by user's linked devices
    // The subscription will only receive events for locations the user can access
    const channel = supabase
      .channel('live_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          // Note: Realtime respects RLS, so we'll only get events for authorized locations
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pollInterval]); // fetchLocations is stable, no need to include

  return { locations, loading, error, refetch: fetchLocations };
};
