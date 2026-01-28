import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useGeofences } from '../hooks/useGeofences';
import { useApp } from '../contexts/AppContext';
import { Switch } from '../components/ui/switch';
import { AlertTriangle, Battery, Activity, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import backgroundImage from '../assets/P1260790-2.jpg';

export const CustomizeAlerts: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = useSettings(user?.id);
  const { geofences, loading: geofencesLoading } = useGeofences(user?.id);
  const { navigateBackToLast, setLastRoute, setLastMainTab } = useApp();
  
  // Get mode from URL params or location state, default to 'create'
  const mode = (searchParams.get('mode') || (location.state as { mode?: string })?.mode || 'create') as 'create' | 'edit';
  
  // Get navigation state from location
  const fromState = (location.state as { from?: { pathname: string; mainTab?: string } })?.from;
  
  // Track navigation state
  useEffect(() => {
    if (fromState) {
      setLastRoute(fromState.pathname);
      if (fromState.mainTab) {
        setLastMainTab(fromState.mainTab as any);
      }
    }
  }, [fromState, setLastRoute, setLastMainTab]);
  
  // Alert settings state (from Supabase settings table)
  const [outOfRange, setOutOfRange] = useState(true);
  const [lowBattery, setLowBattery] = useState(true);
  const [inactivity, setInactivity] = useState(true);
  
  // Boundary Buffer state (local only, saved on Save button click)
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(null);
  const [bufferEnabled, setBufferEnabled] = useState(false);
  const [bufferMeters, setBufferMeters] = useState(0);
  
  // Load settings from Supabase and initialize local state
  useEffect(() => {
    if (settings) {
      setOutOfRange(settings.enable_out_of_range ?? true);
      setLowBattery(settings.enable_low_battery ?? true);
      setInactivity(settings.enable_inactiviy ?? true); // Note: matches DB column name
      
      // Initialize Boundary Buffer local state from DB
      const bufferValue = settings.boundary_buffer_m ?? 0;
      setBufferMeters(Math.max(0, Math.min(50, bufferValue))); // Clamp to 0-50
      setBufferEnabled(bufferValue > 0);
    }
  }, [settings]);
  
  // Load first geofence by default (for geofence selector only)
  useEffect(() => {
    if (geofences.length > 0 && !selectedGeofenceId) {
      setSelectedGeofenceId(geofences[0].id);
    }
  }, [geofences, selectedGeofenceId]);
  
  
  const handleSaveSettings = async () => {
    if (!user?.id) return;
    
    try {
      // Compute final boundary_buffer_m value: 0 if toggle OFF, slider value if ON
      const finalBufferMeters = bufferEnabled ? Math.max(0, Math.min(50, bufferMeters)) : 0;
      
      // Upsert settings (create if doesn't exist, update if exists)
      const updates: any = {
        enable_out_of_range: outOfRange,
        enable_inactiviy: inactivity, // Note: matches DB column name
        enable_low_battery: lowBattery,
        boundary_buffer_m: finalBufferMeters, // Save Boundary Buffer value
      };
      
      const { error } = await updateSettings(updates);
      
      if (error) {
        throw error;
      }
      
      toast.success('Settings saved successfully');
      
      // Navigate based on mode
      if (mode === 'create') {
        // Create mode: Continue goes to MainApp HomeTab
        navigate('/main', { state: { restoreTab: 'home' } });
      } else {
        // Edit mode: navigate back to last screen/tab
        navigateBackToLast(navigate);
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleDiscard = () => {
    // Edit mode: Discard goes back without saving
    navigateBackToLast(navigate);
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
          {mode === 'create' ? 'Create Alerts' : 'Edit Alerts'}
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
                // Note: Buffer value is now stored in settings, not geofences
                // The geofence selector is only for selecting which geofence to apply buffer to (future use)
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
              onCheckedChange={setBufferEnabled}
              disabled={settingsLoading}
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
                  setBufferMeters(Math.max(0, Math.min(50, newValue))); // Clamp to 0-50, local state only
                }}
                disabled={settingsLoading}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--grass-green)]"
              />
              <div className="flex justify-between text-xs text-gray-500">
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0 relative z-10">
        <div className="flex gap-2">
          {mode === 'create' ? (
            <>
              <GeoButton 
                variant="outline" 
                onClick={() => navigate('/link-devices', { state: { mode: 'create', from: { pathname: '/customize-alerts', mainTab: undefined } } })}
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
                Continue
              </GeoButton>
            </>
          ) : (
            <>
              <GeoButton 
                variant="outline" 
                onClick={handleDiscard}
                className="flex-1"
              >
                Discard
              </GeoButton>
              <GeoButton 
                variant="primary" 
                onClick={handleSaveSettings}
                className="flex-1"
                disabled={settingsLoading}
              >
                Save
              </GeoButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};