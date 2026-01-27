import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { MapPin, Smartphone, Bell } from 'lucide-react';
import backgroundImage from '../assets/20250621-P1300279.jpg';

export const Tutorial: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Mark tutorial as seen when user clicks Continue
  const markTutorialSeen = async () => {
    if (!user?.id) {
      console.error('Cannot mark tutorial seen: user not found');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_seen: true })
        .eq('id', user.id); // RLS ensures user can only update their own profile
      // Note: profiles.id = auth.users.id (primary key, FK)

      if (error) {
        throw error;
      }

      // Success - no toast needed, user is navigating away
    } catch (error: any) {
      console.error('Error marking tutorial seen:', error);
      // Log error details (always log for debugging)
      console.error('Supabase error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      // Show toast in dev mode for debugging (check if we're in dev)
      // Note: In production, errors are logged but don't show toast to avoid disrupting UX
      // Don't block navigation on error - proceed anyway
    }
  };

  const handleContinue = async () => {
    await markTutorialSeen();
    navigate('/draw-geofence?mode=create');
  };

  const handleSkip = () => {
    // Skip doesn't mark tutorial as seen - user can see it again next time
    navigate('/main');
  };

  return (
    <div className="mobile-screen green-gradient-bg flex flex-col items-center justify-center px-6 py-8 relative">
      {/* Background Image Overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
              style={{
                backgroundImage: `url(${backgroundImage})`
              }}
            />
        <h1
          className="text-white text-center mb-2"
          style={{ fontWeight: 700, fontSize: '2rem' }}
        >
          Let's start creating your Geofence
        </h1>
      
      {/* Tutorial Content */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 max-w-md relative z-10">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="bg-[var(--grass-green)] p-3 rounded-full shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="text-white">
              <h4 className="mb-1">Draw Your Fence</h4>
              <p className="opacity-90">Create safe zones on the map for your livestock</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="bg-[var(--accent-aqua)] p-3 rounded-full shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="text-white">
              <h4 className="mb-1">Link Devices</h4>
              <p className="opacity-90">Assign GPS trackers to each animal</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="bg-[var(--high-yellow)] p-3 rounded-full shrink-0">
              <Bell className="w-5 h-5 text-[var(--deep-forest)]" />
            </div>
            <div className="text-white">
              <h4 className="mb-1">Monitor Alerts</h4>
              <p className="opacity-90">Get notified when animals leave the safe zone</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Buttons - Only Continue and Skip */}
      <div className="space-y-3 w-full max-w-md relative z-10">
        <GeoButton 
          variant="primary" 
          onClick={handleContinue}
          className="w-full"
        >
          Continue
        </GeoButton>
        
        <GeoButton 
          variant="outline" 
          onClick={handleSkip}
          className="w-full"
        >
          Skip
        </GeoButton>
      </div>
    </div>
  );
};
