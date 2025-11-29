import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/shadcn/components/button';
import { Input } from '@/shadcn/components/input';
import { Label } from '@/shadcn/components/label';
import { CognitoAuthError } from '@/services/cognito';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      if (err instanceof Error) {
        // Check for new password required
        if (err.message === 'New password required' ||
            (err instanceof CognitoAuthError && err.code === 'NewPasswordRequired')) {
          navigate('/force-change-password');
          return;
        }
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Image (70%) */}
      <div
        className="w-[70%] hidden md:block relative"
        style={{
          backgroundImage: 'url(/gs-foods-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Glass overlay with logo */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
          <img
            src="https://gsfoodsgroup.com/wp-content/uploads/2020/09/GSFoodsGroup_Logo_White-optimized.png"
            alt="GS Foods Group"
            className="h-[28rem] w-auto"
          />
        </div>
      </div>

      {/* Right side - Sign In Form (30%) */}
      <div className="w-[30%] flex items-center justify-center p-8" style={{ backgroundColor: '#fff' }}>
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Sign In</h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              Enter your credentials to access your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              style={{ backgroundColor: '#539D4C', borderColor: '#539D4C' }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
