import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';

// Higher-order component to protect routes that require authentication
export default function withAuth(WrappedComponent) {
  const WithAuth = (props) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      // If not loading and no user is found, redirect to login
      if (!loading && !user) {
        router.replace('/login');
      }
    }, [user, loading, router]);

    // Show nothing while loading or redirecting
    if (loading || !user) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          color: '#3c9f6b'
        }}>
          Loading...
        </div>
      );
    }

    // If user is authenticated, render the component
    return <WrappedComponent {...props} />;
  };

  return WithAuth;
} 