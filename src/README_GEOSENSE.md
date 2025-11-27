# GeoSense - Livestock Geofencing and Monitoring

A modern mobile-first web application for livestock geofencing and monitoring with GPS tracking.

## Features

### 1. Authentication & Onboarding
- **Welcome Screen**: Minimalist landing page with login/signup options
- **Sign Up**: User registration with email and password
- **Log In**: User authentication
- **Tutorial**: Interactive onboarding explaining the app's features

### 2. Geofence Management
- **Draw Geofence**: Interactive map for creating polygon geofences
- **Location Search**: Search by city or coordinates
- **Current Location**: GPS-based positioning
- **Edit/Delete**: Modify or remove existing geofences
- **Buffer Zones**: 10% buffer visualization around geofences

### 3. Device Management
- **Link Devices**: Add GPS trackers to animals
- **Device Details**: Store animal name, ID, age, weight, and batch ID
- **Edit/Remove**: Manage device assignments
- **Real-time Status**: Track device battery and connection status

### 4. Alert System
- **Out of Range**: Alerts when animals leave geofence for >30s
- **Low Battery**: Notifications when device battery <15%
- **Inactivity**: Alerts for no movement for 15+ minutes
- **Customizable**: Toggle each alert type on/off

### 5. Main Dashboard (Tabbed Navigation)

#### Home Tab
- Animals inside/outside geofence count
- Active alerts summary
- Last update timestamp
- Quick statistics overview

#### Map Tab
- Full-screen interactive map
- Color-coded device markers:
  - Green: Inside fence
  - Yellow: Outside <30s
  - Red: Outside ≥30s
- Geofence polygon with buffer zone
- Recenter controls (animal/fence)
- Zoom controls
- Edit/delete geofence options

#### Alerts Tab
- Chronological list of all alerts
- Alert type indicators
- Time since alert
- Device and animal information

#### Analytics Tab
- Per-animal movement data
- Speed (average and current)
- Active/inactive time tracking
- Distance traveled today
- Expandable detail views with:
  - Timeline graphs
  - Historical movement data
  - Date selector for historical analysis
- Herd overview statistics

### 6. Settings
- Profile information
- Edit geofence (quick navigation)
- Manage devices (quick navigation)
- Change alerts (quick navigation)
- Language selector: EN, DE, ES, FR, IT, PT
- Units toggle: km / miles
- Logout functionality

## Design System

### Color Palette
- **Deep Forest**: `#0F3C28` - Primary dark green
- **Pine Green**: `#195A3A` - Secondary green
- **Grass Green**: `#78A64A` - Primary accent
- **High Yellow**: `#FFEE8A` - Warning/highlight color
- **Accent Aqua**: `#3FB7FF` - Interactive elements
- **White/Black**: Standard text colors

### Typography
- Clean sans-serif fonts (system defaults)
- Responsive font sizing
- Clear hierarchy with h1-h4 headings

### Layout
- Mobile-first design
- Full-screen views (no scrollbars on screens 1-8)
- Bottom tab navigation in main app
- Compact spacing for mobile optimization

## Technology Stack

- **React**: UI framework
- **TypeScript**: Type safety
- **React Router**: Navigation
- **React Leaflet**: Interactive maps
- **Leaflet Draw**: Geofence drawing tools
- **Recharts**: Analytics charts
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling
- **Context API**: State management

## State Management

The app uses React Context for global state management:
- User authentication state
- Devices and their real-time data
- Geofences
- Alerts and alert settings
- User preferences (language, units)

## Mock Data

The application includes mock data for demonstration:
- Sample devices with various statuses
- Simulated GPS coordinates
- Battery levels and movement data
- Alert generation based on device status

## Navigation Flow

```
Welcome → Sign Up/Login → Tutorial → Draw Geofence → Link Devices → Customize Alerts → Main App
                                                                                      ↓
                                                                              [Home|Map|Alerts|Analytics]
                                                                                      ↓
                                                                                  Settings
```

## Key Components

- **AppContext**: Global state management
- **GeoButton**: Styled button component
- **GeoInput**: Styled input component
- **Screen Components**: Welcome, SignUp, Login, Tutorial, DrawGeofence, LinkDevices, CustomizeAlerts, MainApp, Settings
- **Tab Components**: HomeTab, MapTab, AlertsTab, AnalyticsTab

## Mobile Optimization

- Uses `100vh` and `100dvh` for proper mobile viewport handling
- Touch-optimized controls
- Responsive font sizing
- No horizontal scrolling
- Gesture-friendly interactions

## Future Enhancements

- Real backend integration with REST API
- WebSocket for real-time updates
- Push notifications for alerts
- Historical data storage and retrieval
- Advanced analytics and reporting
- Multi-geofence support
- Herd grouping and management
- Export functionality for reports
- Offline mode support

## Development Notes

- All screens 1-8 are designed to fit on a single mobile screen without scrolling
- Map interactions use Leaflet for cross-browser compatibility
- Mock geocoding is used for location search (integrate Nominatim in production)
- Alert system generates alerts based on device status and settings
- Charts use Recharts for performance and customization

## Getting Started

1. The app starts at the Welcome screen
2. Sign up or log in to access the app
3. Follow the tutorial to set up your first geofence
4. Link devices to your animals
5. Customize alert preferences
6. Monitor your herd from the main dashboard

## Support

For issues or questions, refer to the inline code comments and component documentation.
