import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Settings {
  id: string;
  user_id: string;
  inactivity_minutes?: number; // Deprecated, kept for migration compatibility
  low_battery_threshold?: number; // Deprecated, kept for migration compatibility
  enable_out_of_range: boolean;
  enable_inactiviy: boolean; // Note: matches DB column name exactly (with typo)
  enable_low_battery: boolean;
  boundary_buffer_m: number; // Boundary buffer distance in meters (0-50)
  created_at: string;
  updated_at: string;
}

export const useSettings = (userId?: string) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Not found - create default settings
          const { data: newSettings, error: createError } = await supabase
            .from('settings')
            .insert({
              user_id: userId,
              enable_out_of_range: true,
              enable_inactiviy: true,
              enable_low_battery: true,
              boundary_buffer_m: 0, // Default: toggle OFF
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }
          setSettings(newSettings);
        } else {
          throw fetchError;
        }
      } else {
        setSettings(data);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    if (!userId) return { error: new Error('No user') };
    
    // If settings don't exist, create them first
    if (!settings) {
      await fetchSettings();
    }

    try {
      const { data, error: updateError } = await supabase
        .from('settings')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setSettings(data);
      return { data, error: null };
    } catch (err) {
      console.error('Error updating settings:', err);
      return { data: null, error: err };
    }
  };

  useEffect(() => {
    fetchSettings();

    // Set up real-time subscription
    const channel = supabase
      .channel('settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: userId ? `user_id=eq.${userId}` : undefined,
        },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { settings, loading, error, updateSettings, refetch: fetchSettings };
};
