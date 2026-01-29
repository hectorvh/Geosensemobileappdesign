import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import welcomeImage from '@/assets/20250621-P1300259-2-3.jpg';
import logo from '../assets/logo.png';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  
  // Adjustable logo opacity (0.0 to 1.0)
  const logoOpacity = 0.5; // Change this value to adjust opacity (e.g., 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
  
  // Adjustable logo max width (in rem) - should be similar to title width
  // Title font size is 4rem, so logo width should be around 8-12rem to match title width
  const logoMaxWidth = '18rem'; // Change this value to adjust logo size (e.g., '8rem', '9rem', '10rem', '11rem', '12rem')

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
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="mb-8">
          {/* Logo - sized to match title width */}
          <div className="flex justify-center mb-4">
            <img 
              src={logo} 
              alt="GeoSense logo" 
              className="w-auto h-auto"
              style={{ 
                objectFit: 'contain', 
                opacity: logoOpacity,
                maxWidth: logoMaxWidth
              }}
            />
          </div>
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
