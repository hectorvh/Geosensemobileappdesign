import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useApp } from '../contexts/AppContext';
import welcomeImage from '../assets/P1260790-2.jpg';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Mock user creation
    const newUser = {
      id: Date.now().toString(),
      email,
      language: 'EN' as const,
      units: 'km' as const,
    };
    
    setUser(newUser);
    navigate('/tutorial');
  };

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
      <div className="relative z-10 w-full max-w-md px-6 relative z-10">
          <h1
            className="text-white text-center mb-2"
            style={{ fontWeight: 700, fontSize: '3rem' }}
          >
            Create new account
          </h1>
        
        <form onSubmit={handleSignUp} className="space-y-4">
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
          
          <GeoInput
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          
          <div className="space-y-3 pt-4">
            <GeoButton 
              type="submit"
              variant="primary" 
              className="w-full"
            >
              Sign up
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
