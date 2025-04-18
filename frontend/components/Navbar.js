import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import { useAuth } from '../utils/AuthContext';

const NavContainer = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: #3c9f6b;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;

const NavLink = styled.a`
  color: #555;
  text-decoration: none;
  font-size: 1rem;
  transition: color 0.2s;
  cursor: pointer;

  &:hover {
    color: #3c9f6b;
  }

  &.active {
    color: #3c9f6b;
    font-weight: 500;
  }
`;

const AuthButton = styled.button`
  background-color: ${props => props.primary ? '#3c9f6b' : 'transparent'};
  color: ${props => props.primary ? 'white' : '#3c9f6b'};
  border: ${props => props.primary ? 'none' : '1px solid #3c9f6b'};
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: ${props => props.primary ? '#2e8b57' : 'rgba(60, 159, 107, 0.1)'};
  }
`;

export default function Navbar() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    setCurrentPath(router.pathname);
  }, [router.pathname]);

  return (
    <NavContainer>
      <Logo>
        <Link href="/" passHref legacyBehavior>
          <NavLink>CropCare</NavLink>
        </Link>
      </Logo>
      
      <NavLinks>
        <Link href="/" passHref legacyBehavior>
          <NavLink className={currentPath === '/' ? 'active' : ''}>Home</NavLink>
        </Link>
        
        <Link href="/dashboard" passHref legacyBehavior>
          <NavLink className={currentPath === '/dashboard' ? 'active' : ''}>Dashboard</NavLink>
        </Link>
        <Link href="/history" passHref legacyBehavior>
          <NavLink className={currentPath === '/history' ? 'active' : ''}>History</NavLink>
        </Link>
        <Link href="/chatbot" passHref legacyBehavior>
          <NavLink className={currentPath === '/chatbot' ? 'active' : ''}>Chatbot</NavLink>
        </Link>
        <AuthButton onClick={signOut}>Sign Out</AuthButton>
      </NavLinks>
    </NavContainer>
  );
} 