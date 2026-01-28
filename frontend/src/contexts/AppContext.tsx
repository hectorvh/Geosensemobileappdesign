import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Device {
  id: string;
  animalName: string;
  age?: number;
  weight?: number;
  batchId?: string;
  lat: number;
  lng: number;
  status: 'inside' | 'outside-recent' | 'outside-alert';
  batteryLevel: number;
  lastActive: Date;
  speed: number;
  activeTime: number; // minutes today
  inactiveTime: number; // minutes today
  distanceToday: number; // km
}

export interface Geofence {
  id: string;
  name: string;
  coordinates: [number, number][];
  userId: string;
}

export interface Alert {
  id: string;
  deviceId: string;
  animalName: string;
  type: 'out-of-range' | 'low-battery' | 'inactivity';
  timestamp: Date;
  resolved: boolean;
}

export interface AlertSettings {
  outOfRange: boolean;
  lowBattery: boolean;
  inactivity: boolean;
}

export interface User {
  id: string;
  email: string;
  language: 'EN' | 'DE' | 'ES' | 'FR' | 'IT' | 'PT';
  units: 'km' | 'miles';
}

export type MainTab = 'home' | 'map' | 'alerts' | 'analytics';

export interface NavigationState {
  pathname: string;
  mainTab?: MainTab;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  devices: Device[];
  setDevices: (devices: Device[]) => void;
  geofences: Geofence[];
  setGeofences: (geofences: Geofence[]) => void;
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  alertSettings: AlertSettings;
  setAlertSettings: (settings: AlertSettings) => void;
  addDevice: (device: Device) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  removeDevice: (id: string) => void;
  addGeofence: (geofence: Geofence) => void;
  updateGeofence: (id: string, updates: Partial<Geofence>) => void;
  removeGeofence: (id: string) => void;
  activeMainTab: MainTab;
  setActiveMainTab: (tab: MainTab) => void;
  lastRoute: string | null;
  lastMainTab: MainTab | null;
  setLastRoute: (route: string | null) => void;
  setLastMainTab: (tab: MainTab | null) => void;
  navigateBackToLast: (navigate: (path: string, options?: { state?: any }) => void) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    outOfRange: true,
    lowBattery: true,
    inactivity: true,
  });
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('home');
  const [lastRoute, setLastRoute] = useState<string | null>(null);
  const [lastMainTab, setLastMainTab] = useState<MainTab | null>(null);

  const navigateBackToLast = (navigate: (path: string, options?: { state?: any }) => void) => {
    if (lastRoute) {
      // If last route was /main, restore the tab
      if (lastRoute === '/main' && lastMainTab) {
        navigate('/main', { state: { restoreTab: lastMainTab } });
      } else {
        navigate(lastRoute);
      }
    } else {
      // Default fallback to home tab
      navigate('/main', { state: { restoreTab: 'home' } });
    }
  };

  const addDevice = (device: Device) => {
    setDevices((prev) => [...prev, device]);
  };

  const updateDevice = (id: string, updates: Partial<Device>) => {
    setDevices((prev) =>
      prev.map((device) => (device.id === id ? { ...device, ...updates } : device))
    );
  };

  const removeDevice = (id: string) => {
    setDevices((prev) => prev.filter((device) => device.id !== id));
  };

  const addGeofence = (geofence: Geofence) => {
    setGeofences((prev) => [...prev, geofence]);
  };

  const updateGeofence = (id: string, updates: Partial<Geofence>) => {
    setGeofences((prev) =>
      prev.map((geofence) => (geofence.id === id ? { ...geofence, ...updates } : geofence))
    );
  };

  const removeGeofence = (id: string) => {
    setGeofences((prev) => prev.filter((geofence) => geofence.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        devices,
        setDevices,
        geofences,
        setGeofences,
        alerts,
        setAlerts,
        alertSettings,
        setAlertSettings,
        addDevice,
        updateDevice,
        removeDevice,
        addGeofence,
        updateGeofence,
        removeGeofence,
        activeMainTab,
        setActiveMainTab,
        lastRoute,
        lastMainTab,
        setLastRoute,
        setLastMainTab,
        navigateBackToLast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
