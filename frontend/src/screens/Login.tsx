import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeoButton } from '../components/GeoButton';
import { GeoInput } from '../components/GeoInput';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import welcomeImage from '../assets/P1260790-2.jpg';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const { data, error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      
      if (data?.user) {
        // Check if user has seen tutorial
        const { data: profile } = await supabase
          .from('profiles')
          .select('tutorial_seen')
          .eq('id', data.user.id)
          .single();
        
        if (profile?.tutorial_seen) {
          navigate('/main');
        } else {
          navigate('/tutorial');
        }
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
      <div className="absolute bottom-0 left-0 right-0 z-10 w-full max-w-sm px-6 pb-8 mx-auto">

        
        <h1
          className="text-white text-center mb-2"
          style={{ fontWeight: 700, fontSize: '3rem' }}
        >
          Log In
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
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
          
          <div className="space-y-4 pt-4">
            <GeoButton 
              type="submit"
              variant="primary" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Log in'}
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
