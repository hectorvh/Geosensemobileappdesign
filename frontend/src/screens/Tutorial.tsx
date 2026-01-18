import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MapPin, Smartphone, Bell } from 'lucide-react';
import backgroundImage from '../assets/20250621-P1300279.jpg';

export const Tutorial: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Mark tutorial as seen when component mounts
  useEffect(() => {
    const markTutorialSeen = async () => {
      if (user && profile) {
        // Check if tutorial_seen flag exists in profile
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('tutorial_seen')
          .eq('id', user.id)
          .single();

        if (!existingProfile?.tutorial_seen) {
          // Update profile to mark tutorial as seen
          await supabase
            .from('profiles')
            .update({ tutorial_seen: true })
            .eq('id', user.id);
        }
      }
    };

    markTutorialSeen();
  }, [user, profile]);

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
          onClick={() => navigate('/draw-geofence?mode=create')}
          className="w-full"
        >
          Continue
        </GeoButton>
        
        <GeoButton 
          variant="outline" 
          onClick={() => navigate('/main')}
          className="w-full"
        >
          Skip
        </GeoButton>
      </div>
    </div>
  );
};
