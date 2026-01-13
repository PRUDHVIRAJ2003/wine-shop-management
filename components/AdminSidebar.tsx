'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Archive, Users, Package, LogOut, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  onSignOut: () => void;
}

export default function AdminSidebar({ onSignOut }: AdminSidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: FileText, label: 'Entry View/Edit', href: '/admin/entry' },
    { icon: Archive, label: 'PDF Archives', href: '/admin/archives' },
    { icon: Users, label: 'User Management', href: '/admin/users' },
    { icon: Package, label: 'Product Management', href: '/admin/products' },
  ];

  return (
    <aside className="w-64 bg-primary text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-primary-600">
        <div className="flex items-center space-x-3">
          <Wine size={32} />
          <div>
            <h1 className="text-lg font-bold">Wine Shop</h1>
            <p className="text-xs text-primary-100">Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-white text-primary font-semibold'
                      : 'text-white hover:bg-primary-600'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-primary-600">
        <button
          onClick={onSignOut}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg w-full text-white hover:bg-primary-600 transition-colors"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
