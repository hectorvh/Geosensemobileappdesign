import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useApp, Device } from '../contexts/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export const LinkDevices: React.FC = () => {
  const navigate = useNavigate();
  const { devices, addDevice, updateDevice, removeDevice } = useApp();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    animalName: '',
    age: '',
    weight: '',
    batchId: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.animalName) {
      alert('Device ID and Animal Name are required');
      return;
    }

    // Generate random position near center for demo
    const lat = 51.505 + (Math.random() - 0.5) * 0.1;
    const lng = -0.09 + (Math.random() - 0.5) * 0.1;

    if (editingId) {
      updateDevice(editingId, {
        id: formData.id,
        animalName: formData.animalName,
        age: formData.age ? parseInt(formData.age) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        batchId: formData.batchId || undefined,
      });
      setEditingId(null);
    } else {
      const newDevice: Device = {
        id: formData.id,
        animalName: formData.animalName,
        age: formData.age ? parseInt(formData.age) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        batchId: formData.batchId || undefined,
        lat,
        lng,
        status: 'inside',
        batteryLevel: 85,
        lastActive: new Date(),
        speed: 0,
        activeTime: 0,
        inactiveTime: 0,
        distanceToday: 0,
      };
      addDevice(newDevice);
    }

    setFormData({ id: '', animalName: '', age: '', weight: '', batchId: '' });
    setShowForm(false);
  };

  const handleEdit = (device: Device) => {
    setFormData({
      id: device.id,
      animalName: device.animalName,
      age: device.age?.toString() || '',
      weight: device.weight?.toString() || '',
      batchId: device.batchId || '',
    });
    setEditingId(device.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this device?')) {
      removeDevice(id);
    }
  };

  return (
    <div className="mobile-screen flex flex-col bg-[var(--pine-green)]">
      {/* Header */}
      <div className="bg-[var(--deep-forest)] text-white p-4 shrink-0">
        <h3 className="mb-2">Link Your Devices</h3>
        <p className="text-sm opacity-90">Assign GPS trackers to each animal</p>
      </div>

      {/* Device List & Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Existing Devices */}
        {devices.map((device) => (
          <div key={device.id} className="bg-white/90 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-[var(--deep-forest)]">{device.animalName}</p>
              <p className="text-sm text-gray-600">ID: {device.id}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(device)}
                className="p-2 bg-[var(--accent-aqua)] text-white rounded-lg hover:bg-[var(--pine-green)]"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(device.id)}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

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
              {editingId ? 'Edit Device' : 'Add Device'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <GeoInput
                type="text"
                placeholder="Device ID *"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required
              />
              <GeoInput
                type="text"
                placeholder="Animal Name *"
                value={formData.animalName}
                onChange={(e) => setFormData({ ...formData, animalName: e.target.value })}
                required
              />
              <GeoInput
                type="number"
                placeholder="Age (optional)"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
              <GeoInput
                type="number"
                placeholder="Weight (optional)"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              />
              <GeoInput
                type="text"
                placeholder="Batch ID (optional)"
                value={formData.batchId}
                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
              />
              <div className="flex gap-2">
                <GeoButton type="submit" variant="primary" className="flex-1">
                  {editingId ? 'Update' : 'Add'}
                </GeoButton>
                <GeoButton
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ id: '', animalName: '', age: '', weight: '', batchId: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </GeoButton>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="bg-[var(--deep-forest)] p-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <GeoButton 
            variant="primary" 
            onClick={() => navigate('/customize-alerts')}
            className="flex-1"
          >
            Next
          </GeoButton>
          <GeoButton 
            variant="outline" 
            onClick={() => navigate('/draw-geofence')}
            className="flex-1"
          >
            Back
          </GeoButton>
        </div>
      </div>
    </div>
  );
};
