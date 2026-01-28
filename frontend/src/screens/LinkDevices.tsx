import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useAuth } from '../hooks/useAuth';
import { useDevices } from '../hooks/useDevices';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import backgroundImage from '../assets/P1260790-2.jpg';

export const LinkDevices: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { devices, loading: devicesLoading, refetch: refetchDevices } = useDevices(user?.id);
  const { navigateBackToLast, setLastRoute, setLastMainTab } = useApp();
  
  // Get mode from URL params, default to 'create'
  const mode = (searchParams.get('mode') || 'create') as 'create' | 'edit';
  
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
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    tracker_id: '',
    name: '',
    age: '',
    weight: '',
    batch_id: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.tracker_id || !formData.name) {
      toast.error('Tracker ID and Name are required');
      return;
    }

    if (!user?.id) {
      toast.error('Please log in to link devices');
      return;
    }

    setSubmitting(true);

    try {
      // STEP 1: Check if tracker_id exists in live_locations
      const { data: trackerData, error: trackerError } = await supabase.rpc(
        'check_tracker_exists',
        { p_tracker_id: formData.tracker_id }
      );

      if (trackerError) {
        console.error('Error checking tracker:', trackerError);
        toast.error('Failed to check tracker. Please try again.');
        setSubmitting(false);
        return;
      }

      // Check if tracker exists
      if (!trackerData || trackerData.length === 0 || !trackerData[0].tracker_exists) {
        toast.error('Tracker ID not found. Please verify the tracker ID is correct.');
        setSubmitting(false);
        return;
      }

      const trackerInfo = trackerData[0];
      
      // STEP 2: Tracker found - show confirmation and upsert device
      toast.success('Tracker identified! Linking device...');

      // Prepare device data
      const deviceData: any = {
        tracker_id: formData.tracker_id,
        user_id: user.id,
        name: formData.name,
        animal_name: formData.name, // Also set animal_name for compatibility
        age: formData.age ? parseInt(formData.age) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        batch_id: formData.batch_id || null,
        last_update: trackerInfo.updated_at,
      };

      if (editingId) {
        // SECURITY: Verify ownership before update (defense in depth)
        const { data: existingDevice, error: verifyError } = await supabase
          .from('devices')
          .select('id, user_id')
          .eq('id', editingId)
          .eq('user_id', user.id)
          .single();

        if (verifyError || !existingDevice) {
          toast.error('You don\'t have permission to edit this device.');
          console.error('Device ownership verification failed:', verifyError);
          setSubmitting(false);
          return;
        }

        // Perform update (RLS will also enforce ownership)
        const { data: updatedData, error: updateError } = await supabase
          .from('devices')
          .update(deviceData)
          .eq('id', editingId)
          .eq('user_id', user.id) // Explicit user filter
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // Verify update succeeded (0 rows = permission denied)
        if (!updatedData) {
          toast.error('You don\'t have permission to edit this device.');
          setSubmitting(false);
          return;
        }

        toast.success('Device updated successfully!');
        setEditingId(null);
      } else {
        // Insert new device (upsert to handle duplicate links)
        const { error: insertError } = await supabase
          .from('devices')
          .upsert(deviceData, {
            onConflict: 'user_id,tracker_id',
            ignoreDuplicates: false,
          });

        if (insertError) {
          // Check if it's a duplicate link error
          if (insertError.code === '23505') {
            toast.error('This tracker is already linked to your account.');
          } else {
            throw insertError;
          }
        } else {
          toast.success('Device linked successfully!');
        }
      }

      // Refresh devices list
      await refetchDevices();

      // Clear form and close
      setFormData({ tracker_id: '', name: '', age: '', weight: '', batch_id: '' });
      setShowForm(false);
    } catch (error) {
      console.error('Error linking device:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to link device. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (device: any) => {
    setFormData({
      tracker_id: device.tracker_id,
      name: device.name || device.animal_name || '',
      age: device.age?.toString() || '',
      weight: device.weight?.toString() || '',
      batch_id: device.batch_id || '',
    });
    setEditingId(device.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this device?')) {
      return;
    }

    if (!user?.id) {
      toast.error('Please log in to remove devices');
      return;
    }

    try {
      // SECURITY: Verify ownership before delete (defense in depth)
      const { data: existingDevice, error: verifyError } = await supabase
        .from('devices')
        .select('id, user_id, tracker_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (verifyError || !existingDevice) {
        toast.error('You don\'t have permission to remove this device.');
        console.error('Device ownership verification failed:', verifyError);
        return;
      }

      // Perform delete (RLS will also enforce ownership)
      // This only deletes the association row, not the tracker itself
      const { data: deletedData, error: deleteError } = await supabase
        .from('devices')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id) // Explicit user filter
        .select()
        .single();

      if (deleteError) {
        throw deleteError;
      }

      // Verify delete succeeded (0 rows = permission denied)
      if (!deletedData) {
        toast.error('You don\'t have permission to remove this device.');
        return;
      }

      toast.success('Device removed successfully');
      await refetchDevices();
    } catch (error) {
      console.error('Error removing device:', error);
      toast.error('Failed to remove device. Please try again.');
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
          {mode === 'create' ? 'Add Device' : 'Edit Devices'}
        </h2>
        <p className="text-sm opacity-90">Assign GPS trackers to each animal</p>
      </div>

      {/* Device List & Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10">
        {/* Loading State */}
        {devicesLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--deep-forest)]" />
          </div>
        )}

        {/* Existing Devices */}
        {!devicesLoading && devices.map((device) => (
          <div key={device.id} className="bg-white/90 rounded-lg p-3 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-[var(--deep-forest)] font-medium">
                {device.name || device.animal_name || 'Unnamed Device'}
              </p>
              <p className="text-sm text-gray-600">Tracker ID: {device.tracker_id}</p>
              {(device as any).batch_id && (
                <p className="text-xs text-gray-500">Batch: {(device as any).batch_id}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(device)}
                className="p-2 bg-[var(--accent-aqua)] text-white rounded-lg hover:bg-[var(--pine-green)]"
                title="Edit device"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(device.id)}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                title="Remove device"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {!devicesLoading && devices.length === 0 && !showForm && (
          <div className="text-center p-8 text-gray-500">
            <p>No devices linked yet.</p>
            <p className="text-sm mt-2">Click "Add New Device" to link a tracker.</p>
          </div>
        )}

        {/* Add Device Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-[var(--grass-green)] text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--deep-forest)]"
          >
            <Plus className="w-5 h-5" />
            Add New Device
          </button>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white/90 rounded-lg p-4">
            <h4 className="text-[var(--deep-forest)] mb-3">
              {editingId ? 'Edit Device' : 'Link New Device'}
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              Enter the tracker ID from your GPS device. The system will verify it exists before linking.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <GeoInput
                  type="text"
                  placeholder="Tracker ID *"
                  value={formData.tracker_id}
                  onChange={(e) => setFormData({ ...formData, tracker_id: e.target.value.trim() })}
                  required
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The tracker ID must exist in the system
                </p>
              </div>
              <GeoInput
                type="text"
                placeholder="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.trim() })}
                required
                disabled={submitting}
              />
              <GeoInput
                type="number"
                placeholder="Age (years, optional)"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                disabled={submitting}
                min="0"
              />
              <GeoInput
                type="number"
                placeholder="Weight (kg, optional)"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                disabled={submitting}
                min="0"
                step="0.1"
              />
              <GeoInput
                type="text"
                placeholder="Batch ID (optional)"
                value={formData.batch_id}
                onChange={(e) => setFormData({ ...formData, batch_id: e.target.value.trim() })}
                disabled={submitting}
              />
              <div className="flex gap-2">
                <GeoButton 
                  type="submit" 
                  variant="primary" 
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      {editingId ? 'Updating...' : 'Linking...'}
                    </>
                  ) : (
                    editingId ? 'Update' : 'Link Device'
                  )}
                </GeoButton>
                <GeoButton
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ tracker_id: '', name: '', age: '', weight: '', batch_id: '' });
                  }}
                  className="flex-1"
                  disabled={submitting}
                  type="button"
                >
                  Cancel
                </GeoButton>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0 relative z-10">
        <div className="flex gap-2">
          {mode === 'create' ? (
            <>
              <GeoButton 
                variant="outline" 
                onClick={() => navigate('/draw-geofence', { state: { mode: 'create', from: { pathname: '/link-devices', mainTab: undefined } } })}
                className="flex-1"
              >
                Back
              </GeoButton>
              <GeoButton 
                variant="primary" 
                onClick={() => navigate('/customize-alerts', { state: { mode: 'create', from: { pathname: '/link-devices', mainTab: undefined } } })}
                className="flex-1"
              >
                Continue
              </GeoButton>
            </>
          ) : (
            <GeoButton 
              variant="outline" 
              onClick={() => navigateBackToLast(navigate)}
              className="flex-1"
            >
              Back
            </GeoButton>
          )}
        </div>
      </div>
    </div>
    );
};
