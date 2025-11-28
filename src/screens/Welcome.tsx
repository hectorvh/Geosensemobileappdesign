import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import welcomeImage from '@/assets/20250621-P1300259-2-3.jpg';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mobile-screen green-gradient-bg flex items-center justify-center relative">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: `url(${welcomeImage})`
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 text-center px-12 space-y-4 max-w-sm">
        <div className="mb-16">
          <h1 className="text-white" style={{ fontWeight: 700 }}>GeoSense</h1>
          <p className="text-white mt-2" style={{ fontWeight: 300 }}>Smart livestock monitoring & geofencing</p>
        </div>
        <div className="space-y-4">
          <GeoButton 
            variant="primary" 
            onClick={() => navigate('/login')}
            className="w-full max-w-xs"
          >
            Log in
          </GeoButton>
          
          <GeoButton 
            variant="outline" 
            onClick={() => navigate('/signup')}
            className="w-full max-w-xs"
          >
            Sign up
          </GeoButton>
        </div>
      </div>
    </div>
  );
};
