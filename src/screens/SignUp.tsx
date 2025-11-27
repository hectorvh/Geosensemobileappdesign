import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useApp } from '../contexts/AppContext';

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
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1641062680671-fec389e4eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaXZlc3RvY2slMjBncmF6aW5nJTIwZmllbGR8ZW58MXx8fHwxNzY0MjcxODM4fDA&ixlib=rb-4.1.0&q=80&w=1080')`
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        <h2 className="text-white text-center mb-8">Create Account</h2>
        
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
