import { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import Link from 'next/link';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background: linear-gradient(135deg, #a8e063 0%, #56ab2f 100%);
`;

const Card = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  padding: 3rem;
  width: 100%;
  max-width: 450px;
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
  }
`;

const Logo = styled.div`
  font-size: 30px;
  font-weight: bold;
  color: #3c9f6b;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const Title = styled.h1`
  color: #333;
  font-size: 1.75rem;
  margin-bottom: 1.5rem;
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const InputGroup = styled.div`
  position: relative;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 1.2rem;
  border: 1px solid #e4e9f0;
  border-radius: 10px;
  font-size: 1rem;
  background-color: #f8fafc;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #3c9f6b;
    background-color: white;
    box-shadow: 0 0 0 3px rgba(60, 159, 107, 0.1);
  }
`;

const Button = styled.button`
  background: linear-gradient(90deg, #3c9f6b, #2ecc71);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;

  &:hover {
    background: linear-gradient(90deg, #2e8b57, #27ae60);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(46, 204, 113, 0.3);
  }

  &:disabled {
    background: linear-gradient(90deg, #a0c4b5, #a0c4b5);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.p`
  color: #e53e3e;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  
  &:before {
    content: "⚠️";
    margin-right: 0.5rem;
  }
`;

const LinkText = styled.p`
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: #666;

  a {
    color: #3c9f6b;
    text-decoration: none;
    font-weight: 600;
    margin-left: 0.3rem;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        throw error;
      }
      
      // Redirect happens automatically via the useEffect above when user state changes
    } catch (error) {
      setError(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Card>
        <Logo>CropCare</Logo>
        <Title>Welcome Back</Title>
        <Form onSubmit={handleSubmit}>
          <InputGroup>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </InputGroup>
          <InputGroup>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </InputGroup>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </Form>
        <LinkText>
          Don't have an account?<Link href="/signup">Sign up</Link>
        </LinkText>
      </Card>
    </Container>
  );
} 