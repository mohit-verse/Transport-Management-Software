import React, { useState } from 'react';
import { Menu, Search, Bell } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { GlobalSearchModal } from '../components/GlobalSearchModal';

export const TopHeader: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
        <button
          type="button"
          className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex-1 px-4 flex justify-between">
          <div className="flex-1 flex items-center">
            <div className="w-full flex md:ml-0">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="relative w-full text-left text-gray-400 focus-within:text-gray-600 max-w-md group"
              >
                <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-500 bg-transparent group-hover:bg-gray-50 rounded-md sm:text-sm cursor-text">
                  Search...
                </div>
              </button>
            </div>
          </div>
          <div className="ml-4 flex items-center md:ml-6 gap-4">
            <button
              type="button"
              className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="sr-only">View notifications</span>
              <Bell className="h-6 w-6" aria-hidden="true" />
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
              <button
                onClick={() => logout()}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
