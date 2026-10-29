import React from 'react';
import { clsx } from 'clsx';
import {
  Home,
  LayoutDashboard,
  Boxes,
  Server,
  BellRing,
  Terminal,
  LogOut,
  Layers,
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  activeAlertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  activeAlertsCount = 0,
}) => {
  const { logout, email } = useAuth();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'pods', label: 'Pods', icon: Boxes },
    { id: 'nodes', label: 'Nodes', icon: Server },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: BellRing,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
    },
    { id: 'logs', label: 'Logs', icon: Terminal },
  ];

  return (
    <aside className="w-56 flex-shrink-0 h-screen bg-surface border-r border-border flex flex-col z-20 select-none">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-border flex items-center space-x-2.5">
        <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-text-primary">
          <Layers className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-tight text-text-primary">
            K8S MONITOR
          </span>
          <span className="text-xxs font-mono text-text-secondary">v1.0.0</span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-xxs font-semibold uppercase tracking-wider text-text-secondary/70">
          Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as NavigationTab)}
              className={clsx(
                'w-full flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors duration-150',
                isActive
                  ? 'bg-accent-muted text-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              )}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive ? 'text-accent' : 'text-text-secondary')} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 font-mono text-xxs bg-status-critical/20 text-status-critical border border-status-critical/30 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-border flex items-center justify-between">
        <div className="flex flex-col min-w-0 mr-2">
          <span className="text-xxs font-mono text-text-secondary truncate">
            {email || 'operator'}
          </span>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
