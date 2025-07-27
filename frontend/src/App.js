import React, { useState, useEffect, createContext, useContext } from 'react';
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('session_token');
    if (token) {
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
    
    // Check for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id') || window.location.hash.split('session_id=')[1];
    
    if (sessionId) {
      handleAuthCallback(sessionId);
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      localStorage.removeItem('session_token');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthCallback = async (sessionId) => {
    try {
      const response = await axios.post(`${API}/auth/session`, {
        session_id: sessionId
      });
      
      const { user: userData, is_new_user } = response.data;
      localStorage.setItem('session_token', userData.session_token);
      setUser(userData);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Redirect new users to profile completion
      if (is_new_user) {
        // Will be handled by the component
      }
    } catch (error) {
      console.error('Auth callback failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        host_url: window.location.origin
      });
      window.location.href = response.data.auth_url;
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('session_token');
    setUser(null);
  };

  const completeProfile = async (profileData) => {
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/auth/complete-profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh user data
      await fetchUserProfile(token);
    } catch (error) {
      console.error('Profile completion failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      completeProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Components
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-bone-white">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-steel-blue"></div>
  </div>
);

const LandingPage = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-bone-white">
      {/* Header */}
      <nav className="bg-steel-blue shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">LebFix</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={login}
                className="bg-forest-green hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Sign In / Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-steel-blue to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Lebanon's Premier Service Marketplace
            </h1>
            <p className="text-xl md:text-2xl mb-8">
              Connect with trusted local professionals for all your repair and maintenance needs
            </p>
            <button
              onClick={login}
              className="bg-forest-green hover:bg-green-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors"
            >
              Get Started Today
            </button>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="py-16 bg-warm-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-steel-blue mb-4">Our Services</h2>
            <p className="text-lg text-gray-600">Professional services at your fingertips</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "Electrical",
                icon: "⚡",
                description: "Electrical repairs, installations, and maintenance"
              },
              {
                title: "Technical",
                icon: "🔧",
                description: "Electronics, appliances, and technical repairs"
              },
              {
                title: "Mechanical",
                icon: "⚙️",
                description: "Mechanical systems, cars, and equipment"
              },
              {
                title: "Plumbing",
                icon: "🚿",
                description: "Plumbing repairs, installations, and emergencies"
              }
            ].map((service, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="text-xl font-semibold text-steel-blue mb-2">{service.title}</h3>
                <p className="text-gray-600">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-steel-blue mb-4">How It Works</h2>
            <p className="text-lg text-gray-600">Simple steps to get the help you need</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Choose Your Service",
                description: "Select from electrical, plumbing, technical, or mechanical services"
              },
              {
                step: "2",
                title: "Find Professionals",
                description: "Browse verified freelancers and companies in your area"
              },
              {
                step: "3",
                title: "Book & Get Fixed",
                description: "Schedule your service and get professional help delivered"
              }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="bg-forest-green text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-steel-blue mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-forest-green text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8">Join thousands of satisfied customers and service providers</p>
          <button
            onClick={login}
            className="bg-white text-forest-green hover:bg-gray-100 px-8 py-4 rounded-lg text-lg font-medium transition-colors"
          >
            Sign Up Now
          </button>
        </div>
      </div>
    </div>
  );
};

const RoleSelection = () => {
  const { user, completeProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState('');
  const [formData, setFormData] = useState({
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole) return;
    
    setLoading(true);
    try {
      await completeProfile({
        role: selectedRole,
        ...formData
      });
    } catch (error) {
      console.error('Failed to complete profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bone-white flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-steel-blue text-center mb-6">Complete Your Profile</h2>
        <p className="text-gray-600 text-center mb-8">Welcome {user?.name}! Please select your role to continue.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">I am a:</label>
            <div className="space-y-3">
              {[
                { value: 'customer', label: 'Customer', desc: 'Looking for services' },
                { value: 'freelance_fixer', label: 'Freelance Fixer', desc: 'Independent service provider' },
                { value: 'company', label: 'Company Owner', desc: 'Managing a service company' }
              ].map((role) => (
                <div key={role.value} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    id={role.value}
                    name="role"
                    value={role.value}
                    checked={selectedRole === role.value}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="h-4 w-4 text-forest-green"
                  />
                  <label htmlFor={role.value} className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">{role.label}</div>
                    <div className="text-sm text-gray-500">{role.desc}</div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-green"
              placeholder="+961 XX XXX XXX"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-green"
              placeholder="Your address in Lebanon"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedRole || loading}
            className={`w-full py-2 px-4 rounded-md font-medium ${
              selectedRole && !loading
                ? 'bg-forest-green hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Creating Profile...' : 'Complete Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Dashboard Components
const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    fetchProviders();
    fetchBookings();
  }, [selectedCategory]);

  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/providers${selectedCategory ? `?category=${selectedCategory}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviders(response.data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const handleBookProvider = (provider) => {
    setSelectedProvider(provider);
    setShowBookingForm(true);
  };

  return (
    <div className="min-h-screen bg-bone-white">
      {/* Navigation */}
      <nav className="bg-steel-blue shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">LebFix</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-soft-brick-red hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Categories */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-steel-blue mb-4">Choose a Service</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: '', name: 'All Services', icon: '🔍' },
              { id: 'electrical', name: 'Electrical', icon: '⚡' },
              { id: 'technical', name: 'Technical', icon: '🔧' },
              { id: 'mechanical', name: 'Mechanical', icon: '⚙️' },
              { id: 'plumbing', name: 'Plumbing', icon: '🚿' }
            ].map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`p-4 rounded-lg text-center transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-forest-green text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } border`}
              >
                <div className="text-2xl mb-2">{category.icon}</div>
                <div className="font-medium">{category.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Service Providers */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-steel-blue mb-4">Available Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => (
              <div key={provider.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-steel-blue">
                      {provider.user?.name}
                    </h3>
                    {provider.company && (
                      <p className="text-sm text-gray-600">{provider.company.name}</p>
                    )}
                    <div className="flex items-center mt-1">
                      <span className="text-yellow-400">★</span>
                      <span className="ml-1 text-sm text-gray-600">
                        {provider.rating?.toFixed(1) || 'New'} ({provider.total_jobs} jobs)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-forest-green">
                      ${provider.hourly_rate || 'Contact'}/hr
                    </div>
                    {provider.emergency_rate && (
                      <div className="text-sm text-gray-600">
                        Emergency: ${provider.emergency_rate}/hr
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {provider.service_categories?.map((cat) => (
                      <span key={cat} className="bg-warm-gray text-steel-blue px-2 py-1 rounded-full text-sm">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
                
                {provider.description && (
                  <p className="text-gray-600 text-sm mb-4">{provider.description}</p>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBookProvider(provider)}
                    className="flex-1 bg-forest-green hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium"
                  >
                    Book Now
                  </button>
                  <button className="bg-steel-blue hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
                    Contact
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Bookings */}
        <div>
          <h2 className="text-2xl font-bold text-steel-blue mb-4">Your Bookings</h2>
          <div className="bg-white rounded-lg shadow-md">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No bookings yet. Book your first service above!
              </div>
            ) : (
              <div className="divide-y">
                {bookings.map((booking) => (
                  <div key={booking.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-steel-blue">
                          {booking.service_category} Service
                        </h3>
                        <p className="text-gray-600">{booking.provider_user?.name}</p>
                        <p className="text-sm text-gray-500">{booking.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          booking.status === 'confirmed' ? 'bg-forest-green text-white' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status}
                        </span>
                        <div className="mt-2 text-lg font-bold text-forest-green">
                          ${booking.price}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && selectedProvider && (
        <BookingModal 
          provider={selectedProvider} 
          onClose={() => {
            setShowBookingForm(false);
            setSelectedProvider(null);
          }}
          onSuccess={() => {
            setShowBookingForm(false);
            setSelectedProvider(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

const BookingModal = ({ provider, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    service_category: provider.service_categories?.[0] || 'electrical',
    description: '',
    scheduled_date: '',
    location: { address: '', lat: 0, lng: 0 },
    emergency: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/bookings`, {
        provider_id: provider.id,
        ...formData,
        scheduled_date: new Date(formData.scheduled_date).toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onSuccess();
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-steel-blue">Book Service</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
            <select
              value={formData.service_category}
              onChange={(e) => setFormData({ ...formData, service_category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {provider.service_categories?.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Describe the issue or service needed"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date & Time</label>
            <input
              type="datetime-local"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.location.address}
              onChange={(e) => setFormData({ 
                ...formData, 
                location: { ...formData.location, address: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Service address"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="emergency"
              checked={formData.emergency}
              onChange={(e) => setFormData({ ...formData, emergency: e.target.checked })}
              className="h-4 w-4 text-forest-green"
            />
            <label htmlFor="emergency" className="ml-2 text-sm text-gray-700">
              Emergency service (+${(provider.emergency_rate || provider.hourly_rate) - (provider.hourly_rate || 0)}/hr)
            </label>
          </div>

          <div className="bg-warm-gray p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Estimated Cost:</span>
              <span className="text-lg font-bold text-forest-green">
                ${formData.emergency ? provider.emergency_rate : provider.hourly_rate}/hour
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Final cost will be confirmed by the service provider
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-forest-green hover:bg-green-700 text-white py-2 px-4 rounded-md"
            >
              {loading ? 'Booking...' : 'Book Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FreelancerDashboard = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showProfileForm, setShowProfileForm] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  return (
    <div className="min-h-screen bg-bone-white">
      {/* Navigation */}
      <nav className="bg-steel-blue shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">LebFix Pro</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-soft-brick-red hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-steel-blue">Total Bookings</h3>
            <p className="text-3xl font-bold text-forest-green">{bookings.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-steel-blue">Pending</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {bookings.filter(b => b.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-steel-blue">Completed</h3>
            <p className="text-3xl font-bold text-forest-green">
              {bookings.filter(b => b.status === 'completed').length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-steel-blue">Rating</h3>
            <p className="text-3xl font-bold text-yellow-500">4.8 ★</p>
          </div>
        </div>

        {/* Profile Setup */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-steel-blue">Service Profile</h2>
            <button
              onClick={() => setShowProfileForm(!showProfileForm)}
              className="bg-forest-green hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              {showProfileForm ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
          
          {showProfileForm ? (
            <ProfileForm onSave={() => setShowProfileForm(false)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700">Services Offered</h4>
                <p className="text-gray-600">Set up your service categories</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Pricing</h4>
                <p className="text-gray-600">Configure your hourly rates</p>
              </div>
            </div>
          )}
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-steel-blue">Recent Bookings</h2>
          </div>
          <div className="divide-y">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No bookings yet. Complete your profile to start receiving requests!
              </div>
            ) : (
              bookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onUpdate={fetchBookings} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileForm = ({ onSave }) => {
  const [formData, setFormData] = useState({
    service_categories: [],
    hourly_rate: 25,
    emergency_rate: 50,
    description: '',
    working_hours: {}
  });
  const [loading, setLoading] = useState(false);

  const serviceCategories = ['electrical', 'technical', 'mechanical', 'plumbing'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('session_token');
      await axios.post(`${API}/providers/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSave();
    } catch (error) {
      console.error('Profile update failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Services I Provide</label>
        <div className="grid grid-cols-2 gap-2">
          {serviceCategories.map((category) => (
            <label key={category} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.service_categories.includes(category)}
                onChange={(e) => {
                  const categories = e.target.checked
                    ? [...formData.service_categories, category]
                    : formData.service_categories.filter(c => c !== category);
                  setFormData({ ...formData, service_categories: categories });
                }}
                className="mr-2"
              />
              <span className="capitalize">{category}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
          <input
            type="number"
            value={formData.hourly_rate}
            onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Rate ($)</label>
          <input
            type="number"
            value={formData.emergency_rate}
            onChange={(e) => setFormData({ ...formData, emergency_rate: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="1"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows="3"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Tell customers about your experience and specialties"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-forest-green hover:bg-green-700 text-white py-2 px-6 rounded-lg"
      >
        {loading ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
};

const BookingCard = ({ booking, onUpdate }) => {
  const updateBookingStatus = async (newStatus) => {
    try {
      const token = localStorage.getItem('session_token');
      await axios.put(`${API}/bookings/${booking.id}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdate();
    } catch (error) {
      console.error('Failed to update booking status:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-steel-blue">{booking.service_category} Service</h3>
          <p className="text-gray-600">Customer: {booking.customer?.name}</p>
          <p className="text-sm text-gray-500">{booking.description}</p>
          <p className="text-sm text-gray-500">
            Scheduled: {new Date(booking.scheduled_date).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-forest-green">${booking.price}</div>
          <span className={`px-2 py-1 rounded-full text-sm ${
            booking.status === 'confirmed' ? 'bg-forest-green text-white' :
            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            booking.status === 'completed' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {booking.status}
          </span>
        </div>
      </div>
      
      {booking.status === 'pending' && (
        <div className="mt-4 space-x-2">
          <button
            onClick={() => updateBookingStatus('confirmed')}
            className="bg-forest-green hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
          >
            Accept
          </button>
          <button
            onClick={() => updateBookingStatus('cancelled')}
            className="bg-soft-brick-red hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
          >
            Decline
          </button>
        </div>
      )}
      
      {booking.status === 'confirmed' && (
        <div className="mt-4">
          <button
            onClick={() => updateBookingStatus('completed')}
            className="bg-forest-green hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
          >
            Mark Complete
          </button>
        </div>
      )}
    </div>
  );
};

const CompanyDashboard = () => {
  const { user, logout } = useAuth();
  const [company, setCompany] = useState(null);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    fetchCompany();
    fetchBookings();
  }, []);

  const fetchCompany = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/companies/my-company`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompany(response.data);
    } catch (error) {
      console.error('Failed to fetch company:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  return (
    <div className="min-h-screen bg-bone-white">
      {/* Navigation */}
      <nav className="bg-steel-blue shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">LebFix Business</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-soft-brick-red hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Company Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-steel-blue mb-4">Company Overview</h2>
          {company ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700">Company Name</h4>
                <p className="text-lg">{company.name}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Employees</h4>
                <p className="text-lg">{company.employees?.length || 0}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Total Bookings</h4>
                <p className="text-lg">{bookings.length}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">Loading company information...</div>
          )}
        </div>

        {/* Employee Management */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-steel-blue mb-4">Employee Management</h2>
          <div className="space-y-4">
            {company?.employees?.length ? (
              company.employees.map((employee) => (
                <div key={employee.id} className="flex justify-between items-center p-4 bg-warm-gray rounded-lg">
                  <div>
                    <h4 className="font-semibold">{employee.name}</h4>
                    <p className="text-sm text-gray-600">{employee.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-600">Employee</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No employees added yet.</p>
                <button className="mt-2 bg-forest-green hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                  Add Employee
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-steel-blue">Company Bookings</h2>
          </div>
          <div className="divide-y">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No bookings yet. Add employees and services to start receiving requests!
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-steel-blue">{booking.service_category} Service</h3>
                      <p className="text-gray-600">Customer: {booking.customer?.name}</p>
                      <p className="text-gray-600">Assigned to: {booking.provider_user?.name}</p>
                      <p className="text-sm text-gray-500">{booking.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-forest-green">${booking.price}</div>
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        booking.status === 'confirmed' ? 'bg-forest-green text-white' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <LandingPage />;
  }

  // Show role selection for users who haven't completed their profile
  if (!user.role || user.role === 'customer' && (!user.phone || !user.address)) {
    return <RoleSelection />;
  }

  // Route to appropriate dashboard based on user role
  switch (user.role) {
    case 'customer':
      return <CustomerDashboard />;
    case 'freelance_fixer':
      return <FreelancerDashboard />;
    case 'employee_fixer':
      return <FreelancerDashboard />; // Same interface for now
    case 'company':
      return <CompanyDashboard />;
    default:
      return <RoleSelection />;
  }
}

// Wrap App with Auth Provider
export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}