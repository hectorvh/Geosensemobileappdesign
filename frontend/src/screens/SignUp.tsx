import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useAuth } from '../hooks/useAuth';
import welcomeImage from '../assets/P1260790-2.jpg';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    
    try {
      const { data, error: signUpError } = await signUp(email, password);
      
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      
      if (data?.user) {
        navigate('/tutorial');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
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
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <GeoInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          
          <GeoInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          
          <GeoInput
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
          
          <div className="space-y-3 pt-4">
            <GeoButton 
              type="submit"
              variant="primary" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Sign up'}
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
