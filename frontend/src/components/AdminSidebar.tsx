import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  ChartLineIcon, 
  ShoppingCartIcon, 
  UsersIcon,
  SignOutIcon 
} from '@phosphor-icons/react';

export function AdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  const dashboardPath = isManager ? '/manager/dashboard' : '/admin/dashboard';
  const ordersPath = isManager ? '/manager/orders' : '/admin/orders';

  const isDashboardActive = location.pathname === '/manager/dashboard' || location.pathname === '/admin/dashboard';
  const isOrdersActive = location.pathname === '/manager/orders' || location.pathname === '/admin/orders';
  const isUsersActive = location.pathname === '/admin/users';

  const portalTitle = isManager ? 'Manager Portal' : 'Admin Portal';
  const roleDisplay = user?.role_display || (isManager ? 'Depot Manager' : 'Administrator');

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r bg-white">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-[#102f71]">Oil Ordering</h2>
        <p className="text-sm text-gray-500 mt-1">{portalTitle}</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Button
          variant={isDashboardActive ? "default" : "ghost"}
          className={`w-full justify-start ${
            isDashboardActive
              ? "bg-[#7fb445] text-white hover:bg-[#7fb445]"
              : "hover:bg-[#7fb445]/15 hover:text-[#102f71]"
          }`}
          onClick={() => navigate(dashboardPath)}
        >
          <ChartLineIcon className="mr-2 h-5 w-5" />
          Dashboard
        </Button>

        <Button
          variant={isOrdersActive ? "default" : "ghost"}
          className={`w-full justify-start ${
            isOrdersActive
              ? "bg-[#7fb445] text-white hover:bg-[#7fb445]"
              : "hover:bg-[#7fb445]/15 hover:text-[#102f71]"
          }`}
          onClick={() => navigate(ordersPath)}
        >
          <ShoppingCartIcon className="mr-2 h-5 w-5" />
          {isManager ? 'Order Review' : 'All Orders'}
        </Button>

        {isAdmin && (
          <Button
            variant={isUsersActive ? "default" : "ghost"}
            className={`w-full justify-start ${
              isUsersActive
                ? "bg-[#7fb445] text-white hover:bg-[#7fb445]"
                : "hover:bg-[#7fb445]/15 hover:text-[#102f71]"
            }`}
            onClick={() => navigate('/admin/users')}
          >
            <UsersIcon className="mr-2 h-5 w-5" />
            Users
          </Button>
        )}
      </nav>

      <div className="p-4 border-t">
        <div className="mb-4">
          <p className="text-sm font-medium text-[#102f71]">{user?.name || user?.username}</p>
          <p className="text-xs text-gray-500">{roleDisplay}</p>
        </div>
        <Button
          variant="outline"
          className="w-full bg-[#7fb445] text-white border-[#7fb445] hover:bg-[#7fb445]/90 hover:border-[#7fb445]"
          onClick={handleLogout}
        >
          <SignOutIcon className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
