import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import welcomeImage from '@/assets/20250621-P1300259-2-3.jpg';
import logo from '../assets/logo.png';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  
  // Adjustable logo background size (percentage of container width)
  const logoBackgroundSize = '70%'; // Change this value to adjust logo size (e.g., '20%', '30%', '40%')
  
  // Adjustable distance from top (percentage of viewport height)
  const logoTopOffset = '15%'; // Change this value to adjust distance from top (e.g., '3%', '5%', '10%')
  
  // Adjustable logo opacity (0.0 to 1.0)
  const logoOpacity = 0.5; // Change this value to adjust opacity (e.g., 0.2, 0.3, 0.4, 0.5)

  return (
    <div className="mobile-screen green-gradient-bg flex items-center justify-center relative">

      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: `url(${welcomeImage})`
        }}
      />

            {/* Background Image Overlay */}
            <div 
        className="absolute inset-0 bg-no-repeat"
        style={{
          backgroundImage: `url(${logo})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `center ${logoTopOffset}`,
          backgroundSize: logoBackgroundSize,
          opacity: logoOpacity
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
