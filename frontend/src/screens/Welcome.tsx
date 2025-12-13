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
      <div className="relative z-10 w-full max-w-sm px-6 relative z-10">
        <div className="mb-8">
          <h1
            className="text-white text-center mb-2"
            style={{ fontWeight: 700, fontSize: '4rem' }}
          >
            GeoSense
          </h1>
          <p className="text-white text-center text-xl font-light">Smart livestock monitoring & geofencing</p>
        </div>
        <div className="space-y-4 pt-20">
          <GeoButton 
            variant="primary" 
            onClick={() => navigate('/login')}
            className="w-full max-w"
          >
            Log in
          </GeoButton>
          
          <GeoButton 
            variant="secondary" 
            onClick={() => navigate('/signup')}
            className="w-full max-w"
          >
            Sign up
          </GeoButton>
        </div>
      </div>
    </div>
  );
};
