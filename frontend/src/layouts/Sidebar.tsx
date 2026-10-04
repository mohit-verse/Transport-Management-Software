import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../store/authStore';
import { cn } from '../utils/utils';
import {
  LayoutDashboard,
  Truck,
  Building2,
  Users,
  Car,
  CircleDollarSign,
  Receipt,
  FileText,
  Files,
  Settings,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['OWNER', 'STAFF', 'CA'] },
  { name: 'Trips', href: '/trips', icon: Truck, roles: ['OWNER', 'STAFF'] },
  { name: 'Parties', href: '/parties', icon: Building2, roles: ['OWNER', 'STAFF', 'CA'] },
  { name: 'Vehicle Owners', href: '/vehicle-owners', icon: Users, roles: ['OWNER', 'STAFF'] },
  { name: 'Market Vehicles', href: '/market-vehicles', icon: Truck, roles: ['OWNER', 'STAFF'] },
  { name: 'Own Fleet', href: '/own-fleet', icon: Car, roles: ['OWNER', 'STAFF'] },
  { name: 'Payments', href: '/payments', icon: CircleDollarSign, roles: ['OWNER', 'STAFF', 'CA'] },
  { name: 'Bills', href: '/bills', icon: Receipt, roles: ['OWNER', 'STAFF', 'CA'] },
  { name: 'Reports', href: '/reports', icon: FileText, roles: ['OWNER', 'CA'] },
  { name: 'Documents', href: '/documents', icon: Files, roles: ['OWNER', 'STAFF'] },
  { name: 'Settings', href: '/settings/system', icon: Settings, roles: ['OWNER'] },
];

export const Sidebar: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  const filteredNavigation = navigation.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <span className="text-xl font-bold text-blue-600">SSRL</span>
            </div>
            <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
              {filteredNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500',
                          'mr-3 flex-shrink-0 h-6 w-6'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};
