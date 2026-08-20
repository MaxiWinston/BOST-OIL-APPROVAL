import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r bg-white">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-[#102f71]">Oil Ordering</h2>
        <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-[#7fb445] hover:text-white active:bg-[#7fb445] active:text-white"
          onClick={() => navigate('/admin/dashboard')}
        >
          <ChartLineIcon className="mr-2 h-5 w-5" />
          Dashboard
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-[#7fb445] hover:text-white active:bg-[#7fb445] active:text-white"
          onClick={() => navigate('/admin/orders')}
        >
          <ShoppingCartIcon className="mr-2 h-5 w-5" />
          All Orders
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-[#7fb445] hover:text-white active:bg-[#7fb445] active:text-white"
          onClick={() => navigate('/admin/users')}
        >
          <UsersIcon className="mr-2 h-5 w-5" />
          Users
        </Button>
      </nav>

      <div className="p-4 border-t">
        <div className="mb-4">
          <p className="text-sm font-medium text-[#102f71]">{user?.name}</p>
          <p className="text-xs text-gray-500">Administrator</p>
        </div>
        <Button
          variant="outline"
          className="w-full bg-[#7fb445] text-white border-[#7fb445] hover:bg-[#7fb445] hover:border-[#7fb445] active:bg-[#7fb445] active:border-[#7fb445]"
          onClick={handleLogout}
        >
          <SignOutIcon className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
