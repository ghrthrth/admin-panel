import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useUserStore from '@/stores/user';
import type { FC, ReactElement } from 'react';

interface RouteGuardProps {
  children?: React.ReactNode;
}

const RouteGuard: FC<RouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userInfo = useUserStore(state => state.userInfo);

  useEffect(() => {
    // Только запрещаем доступ к защищенным роутам
    if (!userInfo && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [userInfo, location.pathname]);

  return children as ReactElement;
};

export default RouteGuard;