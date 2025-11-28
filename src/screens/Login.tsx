import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useApp } from '../contexts/AppContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock user login
    const user = {
      id: Date.now().toString(),
      email,
      language: 'EN' as const,
      units: 'km' as const,
    };
    
    setUser(user);
    navigate('/tutorial');
  };

  return (
    <div className="mobile-screen green-gradient-bg flex items-center justify-center relative">
      {/* Background Image Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: `url('src/assets/20250621-P1300259-2-3.jpg')`

        }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-6">
          <h1
            className="text-white text-center mb-2"
            style={{ fontWeight: 700, fontSize: '4rem' }}
          >
            Log In
          </h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <GeoInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <GeoInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <div className="space-y-4 pt-4">
            <GeoButton 
              type="submit"
              variant="primary" 
              className="w-full"
            >
              Log in
            </GeoButton>
            
            <GeoButton 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              Back
            </GeoButton>
          </div>
        </form>
      </div>
    </div>
  );
};
