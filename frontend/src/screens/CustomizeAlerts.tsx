import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useGeofences } from '../hooks/useGeofences';
import { Switch } from '../components/ui/switch';
import { AlertTriangle, Battery, Activity, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import backgroundImage from '../assets/P1260790-2.jpg';

export const CustomizeAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = useSettings(user?.id);
  const { geofences, loading: geofencesLoading } = useGeofences(user?.id);
  
  // Alert settings state (from Supabase settings table)
  const [outOfRange, setOutOfRange] = useState(true);
  const [lowBattery, setLowBattery] = useState(true);
  const [inactivity, setInactivity] = useState(true);
  
  // Boundary Buffer state
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(null);
  const [bufferEnabled, setBufferEnabled] = useState(false);
  const [bufferMeters, setBufferMeters] = useState(0);
  const [isUpdatingBuffer, setIsUpdatingBuffer] = useState(false);
  
  // Debounce timer ref for buffer updates
  const bufferUpdateTimeoutRef = useRef<number | null>(null);
  
  // Load settings from Supabase
  useEffect(() => {
    if (settings) {
      setOutOfRange(settings.enable_out_of_range ?? true);
      setLowBattery(settings.enable_low_battery ?? true);
      setInactivity(settings.enable_inactiviy ?? true); // Note: matches DB column name
    }
  }, [settings]);
  
  // Load first geofence by default, or selected one
  useEffect(() => {
    if (geofences.length > 0 && !selectedGeofenceId) {
      setSelectedGeofenceId(geofences[0].id);
      setBufferEnabled(geofences[0].buffer_m > 0);
      setBufferMeters(geofences[0].buffer_m || 0);
    } else if (selectedGeofenceId) {
      const geofence = geofences.find(g => g.id === selectedGeofenceId);
      if (geofence) {
        setBufferEnabled(geofence.buffer_m > 0);
        setBufferMeters(geofence.buffer_m || 0);
      }
    }
  }, [geofences, selectedGeofenceId]);
  
  // Update buffer when toggle or slider changes (with debouncing for slider)
  const handleBufferUpdate = useCallback(async (newBufferMeters: number, enabled: boolean, immediate: boolean = false) => {
    if (!selectedGeofenceId || !user?.id) {
      toast.error('Please select a geofence first');
      return;
    }
    
    // Clear any pending debounced update
    if (bufferUpdateTimeoutRef.current) {
      clearTimeout(bufferUpdateTimeoutRef.current);
      bufferUpdateTimeoutRef.current = null;
    }
    
    const performUpdate = async () => {
      setIsUpdatingBuffer(true);
      try {
        const finalBufferMeters = enabled ? newBufferMeters : 0;
        
        // Call RPC function to update buffer
        const { data, error } = await supabase.rpc('update_geofence_buffer', {
          p_geofence_id: selectedGeofenceId,
          p_buffer_m: finalBufferMeters,
          p_user_id: user.id,
        });
        
        if (error) {
          throw error;
        }
        
        // RPC function returns a table, so data is an array
        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error('Update failed: no data returned');
        }
        
        toast.success('Boundary buffer updated successfully');
        
        // Update local state
        setBufferMeters(finalBufferMeters);
        setBufferEnabled(enabled);
      } catch (error: any) {
        console.error('Error updating buffer:', error);
        // Enhanced error logging (always log details for debugging)
        console.error('Buffer update error details:', {
          geofenceId: selectedGeofenceId,
          bufferMeters: newBufferMeters,
          enabled,
          errorMessage: error?.message,
          errorCode: error?.code,
          errorDetails: error?.details,
        });
        toast.error('Failed to update buffer: ' + (error?.message || 'unknown error'));
      } finally {
        setIsUpdatingBuffer(false);
      }
    };
    
    if (immediate) {
      await performUpdate();
    } else {
      // Debounce slider updates (400ms)
      bufferUpdateTimeoutRef.current = window.setTimeout(performUpdate, 400);
    }
  }, [selectedGeofenceId, user?.id]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (bufferUpdateTimeoutRef.current) {
        clearTimeout(bufferUpdateTimeoutRef.current);
      }
    };
  }, []);
  
  const handleSaveSettings = async () => {
    if (!user?.id) return;
    
    try {
      // Upsert settings (create if doesn't exist, update if exists)
      const updates: any = {
        enable_out_of_range: outOfRange,
        enable_inactiviy: inactivity, // Note: matches DB column name
        enable_low_battery: lowBattery,
      };
      
      const { error } = await updateSettings(updates);
      
      if (error) {
        throw error;
      }
      
      toast.success('Settings saved successfully');
      navigate('/main');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="mobile-screen flex flex-col bg-[var(--pine-green)] relative">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`
        }}
      />
      
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0 relative z-10">
        <h2
          className="mb-2"
          style={{ fontWeight: 700, fontSize: '1.4rem' }}
        >
          Customize Your Alerts
        </h2>
        <p className="text-sm opacity-90">Choose which notifications you want to receive</p>
      </div>

      {/* Alert Settings */}
      <div className="flex-1 p-4 space-y-4 relative z-10 overflow-y-auto">
        {/* Geofence Selector (if multiple geofences) */}
        {geofences.length > 1 && (
          <div className="bg-white/90 rounded-lg p-4">
            <label className="block text-sm font-medium text-[var(--deep-forest)] mb-2">
              Select Geofence
            </label>
            <select
              value={selectedGeofenceId || ''}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setSelectedGeofenceId(id);
                const geofence = geofences.find(g => g.id === id);
                if (geofence) {
                  setBufferEnabled(geofence.buffer_m > 0);
                  setBufferMeters(geofence.buffer_m || 0);
                }
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--grass-green)] text-[var(--deep-forest)]"
            >
              {geofences.map((geofence) => (
                <option key={geofence.id} value={geofence.id}>
                  {geofence.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {!selectedGeofenceId && geofences.length === 0 && (
          <div className="bg-white/90 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">
              No geofences found. Create a geofence first to configure buffer settings.
            </p>
          </div>
        )}

        {/* Out of Range */}
        <div className="bg-white/90 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-[var(--grass-green)]" />
                <h4 className="text-[var(--deep-forest)]">Out of Range</h4>
              </div>
              <p className="text-sm text-gray-600">
                Alert when tracker is outside fence for more than 30 seconds
              </p>
            </div>
            <Switch
              checked={outOfRange}
              onCheckedChange={setOutOfRange}
              disabled={settingsLoading}
            />
          </div>
        </div>

        {/* Low Battery */}
        <div className="bg-white/90 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Battery className="w-5 h-5 text-[var(--accent-aqua)]" />
                <h4 className="text-[var(--deep-forest)]">Low Battery</h4>
              </div>
              <p className="text-sm text-gray-600">
                Alert when battery level drops below 15%
              </p>
            </div>
            <Switch
              checked={lowBattery}
              onCheckedChange={setLowBattery}
              disabled={settingsLoading}
            />
          </div>
        </div>

        {/* Inactivity */}
        <div className="bg-white/90 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-[var(--high-yellow)]" />
                <h4 className="text-[var(--deep-forest)]">Inactivity</h4>
              </div>
              <p className="text-sm text-gray-600">
                Alert when no movement detected for 15 minutes
              </p>
            </div>
            <Switch
              checked={inactivity}
              onCheckedChange={setInactivity}
              disabled={settingsLoading}
            />
          </div>
        </div>
        
        {/* Boundary Buffer - Moved to bottom */}
        {selectedGeofenceId && (
          <div className="bg-white/90 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-[var(--grass-green)]" />
                  <h4 className="text-[var(--deep-forest)]">Boundary Buffer</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Add a buffer zone around your geofence boundary
                </p>
              </div>
              <Switch
                checked={bufferEnabled}
                onCheckedChange={(checked) => {
                  setBufferEnabled(checked);
                  handleBufferUpdate(bufferMeters, checked, true); // Immediate for toggle
                }}
                disabled={isUpdatingBuffer}
              />
            </div>
            
            {bufferEnabled && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Buffer Distance</label>
                  <span className="text-sm font-medium text-[var(--deep-forest)]">
                    {bufferMeters} m
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={bufferMeters}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    setBufferMeters(newValue);
                    // Debounced update on slider change
                    handleBufferUpdate(newValue, true, false);
                  }}
                  onMouseUp={() => handleBufferUpdate(bufferMeters, true, true)} // Immediate on release
                  onTouchEnd={() => handleBufferUpdate(bufferMeters, true, true)} // Immediate on release
                  disabled={isUpdatingBuffer}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--grass-green)]"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0 m</span>
                  <span>50 m</span>
                </div>
                {isUpdatingBuffer && (
                  <p className="text-xs text-gray-500 mt-1">Updating...</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0 relative z-10">
        <div className="flex gap-2">
          <GeoButton 
            variant="outline" 
            onClick={() => navigate('/link-devices')}
            className="flex-1"
          >
            Back
          </GeoButton>
          <GeoButton 
            variant="primary" 
            onClick={handleSaveSettings}
            className="flex-1"
            disabled={settingsLoading}
          >
            Save
          </GeoButton>
        </div>
      </div>
    </div>
  );
};