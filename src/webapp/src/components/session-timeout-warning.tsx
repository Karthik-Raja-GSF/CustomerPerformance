import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shadcn/components/alert-dialog';
import { useAuth, getAccessToken } from '@/contexts/auth-context';
import { jwtDecode } from 'jwt-decode';

const WARNING_THRESHOLD = 2 * 60 * 1000; // Show warning 2 minutes before expiry

export function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const { extendSession, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkTokenExpiry = () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const decoded = jwtDecode<{ exp: number }>(token);
        const now = Date.now() / 1000;
        const timeUntilExpiry = (decoded.exp - now) * 1000;

        // Show warning if within threshold
        if (timeUntilExpiry > 0 && timeUntilExpiry <= WARNING_THRESHOLD) {
          setShowWarning(true);
          setRemainingTime(Math.floor(timeUntilExpiry / 1000));
        } else {
          setShowWarning(false);
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkTokenExpiry, 30000);
    checkTokenExpiry(); // Check immediately

    return () => clearInterval(interval);
  }, []);

  // Update remaining time every second when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          // Time's up, logout
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning]);

  const handleExtendSession = async () => {
    try {
      await extendSession();
      setShowWarning(false);
    } catch (error) {
      console.error('Failed to extend session:', error);
      handleLogout();
    }
  };

  const handleLogout = () => {
    setShowWarning(false);
    logout();
    navigate('/login');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in <strong>{formatTime(remainingTime)}</strong>.
            Would you like to extend your session?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogout}>Logout</AlertDialogCancel>
          <AlertDialogAction onClick={handleExtendSession}>
            Extend Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
