import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaChevronDown, FaClipboardCheck, FaFileAlt, FaFilePdf, FaHome, FaList, FaUsers } from 'react-icons/fa';
import CatalogosMenu from '../pages/CatalogosMenu';
import ProfilePicture from '../../../components/ProfilePicture';

const BackIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const getRoleName = (user) => {
  if (user?.is_superuser) return 'Super Admin';
  if (!user?.perfil?.rol) return user?.is_staff ? 'Administrador' : 'Usuario';
  const roles = {
    iiisyp: 'Instituto de investigacion',
    director: 'Director de Carrera',
    jefe_estudios: 'Jefe de Estudios',
    docente: 'Docente',
    coordinador: 'Coordinador POA',
  };
  return roles[user.perfil.rol] || 'Usuario';
};

const POA_ROLE_LABELS = {
  elaborador: 'Elaborador POA',
};

const getPoaRoleLabel = (poaRoles = []) => {
  if (!Array.isArray(poaRoles) || poaRoles.length === 0) return 'Sin rol POA (solo lectura)';
  return poaRoles.map((rol) => POA_ROLE_LABELS[rol] || rol).join(' | ');
};

const getFullName = (user) => {
  const first = user?.first_name || '';
  const last = user?.last_name || '';
  const full = `${first} ${last}`.trim();
  return full || user?.username || 'Usuario';
};

const menuItems = [
  { name: 'Inicio', icon: FaHome, path: '/poa' },
  { name: 'Accesos POA', icon: FaUsers, path: '/poa/accesos' },
  { name: 'Documentos POA', icon: FaFileAlt, path: '/poa/documentos' },
  { name: 'Revision POA', icon: FaClipboardCheck, path: '/poa/documentos-revision' },
  { name: 'Catalogos', icon: FaList, path: '/poa/catalogos' },
  { name: 'Reportes', icon: FaFilePdf, path: '/poa/reportes' },
];

const DESKTOP_BREAKPOINT = 768;
const SIDEBAR_STORAGE_KEY = 'poa-sidebar-open';

const getIsDesktopViewport = () => {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= DESKTOP_BREAKPOINT;
};

const getStoredSidebarOpen = () => {
  if (typeof window === 'undefined') return true;
  if (!getIsDesktopViewport()) return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
};

const Sidebar = ({ onOpenGestionSelector, onOpenRevisionBoard, setSidebarExpanded, user, poaPermissions = {}, poaRoles = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(getIsDesktopViewport);
  const [sidebarOpen, setSidebarOpen] = useState(getStoredSidebarOpen);
  const [showCatalogos, setShowCatalogos] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);

  const collapsed = isDesktop ? !sidebarOpen : !sidebarOpen;
  const canManageAccess = !!poaPermissions?.canManageAccess;

  useEffect(() => {
    const handleResize = () => {
      const nextIsDesktop = getIsDesktopViewport();
      setIsDesktop(nextIsDesktop);
      setSidebarOpen(nextIsDesktop ? getStoredSidebarOpen() : false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setSidebarExpanded(isDesktop ? !collapsed : false);
  }, [collapsed, isDesktop, setSidebarExpanded]);

  const setManualSidebarOpen = (nextOpen) => {
    if (typeof window !== 'undefined' && isDesktop) {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextOpen));
    }
    setSidebarOpen(nextOpen);
  };

  const handleSidebarToggle = () => {
    setManualSidebarOpen(!sidebarOpen);
  };

  const handleMenuClick = () => {
    if (!isDesktop) setSidebarOpen(false);
  };

  const markSelected = (key) => {
    setSelectedKey(key);
    window.setTimeout(() => setSelectedKey((current) => (current === key ? null : current)), 360);
  };

  const handleDocumentosClick = () => {
    markSelected('/poa/documentos');
    handleMenuClick();
    onOpenGestionSelector?.();
  };

  const handleRevisionClick = () => {
    markSelected('/poa/documentos-revision');
    handleMenuClick();
    onOpenRevisionBoard?.();
  };

  const isActive = (path) => {
    if (path === '/poa') return location.pathname === path || location.pathname === '/poa/';
    if (path === '/poa/documentos') return location.pathname === '/poa/documentos';
    if (path === '/poa/documentos-revision') return location.pathname === '/poa/documentos-revision';
    return location.pathname.startsWith(path);
  };

  const getItemClass = (active, key) => (
    `group flex items-center gap-4 w-full transition-all duration-300 rounded-xl ${
      collapsed ? 'justify-center h-14' : 'px-4 py-3'
    } ${
      active
        ? 'poa-sidebar-active-pop bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[inset_4px_0_0_0_#ffffff,0_10px_24px_rgba(0,0,0,0.22)]'
        : 'text-blue-200 hover:bg-blue-800/50 hover:text-white hover:shadow-[inset_4px_0_0_0_#ffffff]'
    } ${selectedKey === key ? 'poa-sidebar-click-pop' : ''}`
  );

  return (
    <>
      {!isDesktop && sidebarOpen && (
        <div
          className="poa-sidebar-backdrop fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {!isDesktop && !sidebarOpen && (
        <button
          className="poa-sidebar-toggle fixed top-3 left-4 z-50 p-2 text-blue-200 hover:text-white transition-all duration-300"
          onClick={handleSidebarToggle}
          title="Expandir menu"
        >
          <FaBars size={24} />
        </button>
      )}

      <div
        className={`poa-sidebar fixed left-0 top-0 h-screen bg-gradient-to-b from-blue-900 to-blue-950 text-white shadow-2xl z-40 transition-all duration-300 flex flex-col ${
          isDesktop ? (collapsed ? 'w-20' : 'w-72') : 'w-[min(82vw,20rem)]'
        } ${isDesktop || sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex mb-1 pt-2 ${collapsed ? 'justify-center' : 'justify-end px-3'}`}>
          <button
            onClick={handleSidebarToggle}
            title={collapsed ? 'Expandir menu' : 'Contraer menu'}
            className="p-2 text-blue-200 hover:text-white transition-all duration-300"
          >
            {collapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>

        <div className="px-4 pb-4 border-b border-blue-800/50">
          <div className="flex flex-col items-center gap-3 p-2 rounded-lg transition-all duration-300">
            <div className={`transition-all duration-300 ${collapsed ? 'w-12 h-12' : 'w-40 h-40'}`}>
              <ProfilePicture user={user} onUpdate={() => {}} />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-center">
                <p className="text-sm font-semibold text-white truncate" title={getFullName(user)}>
                  {getFullName(user)}
                </p>
                <p className="text-xs text-blue-300 truncate" title={getRoleName(user)}>
                  {getRoleName(user)}
                </p>
                <p className="text-[11px] text-cyan-200 truncate mt-1 font-semibold" title={getPoaRoleLabel(poaRoles)}>
                  Rol POA: {getPoaRoleLabel(poaRoles)}
                </p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="mb-6">
            {!collapsed && (
              <h3 className="px-6 text-xs font-semibold uppercase tracking-wider mb-2 text-blue-400">
                Principal
              </h3>
            )}
            <div className={collapsed ? 'space-y-2 px-2' : 'space-y-2 px-4'}>
              {menuItems.filter((item) => (item.path === '/poa/accesos' ? canManageAccess : true)).map((item) => {
                const Icon = item.icon;

                if (item.path === '/poa/catalogos') {
                  return (
                    <div key={item.path}>
                      <button
                        className={getItemClass(showCatalogos && !collapsed, item.path)}
                        onClick={() => {
                          markSelected(item.path);
                          if (collapsed) {
                            handleSidebarToggle();
                            return;
                          }
                          setShowCatalogos(!showCatalogos);
                        }}
                        title={item.name}
                      >
                        <Icon className="w-6 h-6 flex-shrink-0" />
                        {!collapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.name}</span>}
                        {!collapsed && <FaChevronDown className={`ml-auto w-4 h-4 text-blue-300 transition-transform duration-300 ${showCatalogos ? 'rotate-180' : ''}`} />}
                      </button>
                      {showCatalogos && !collapsed && (
                        <CatalogosMenu onMenuClick={() => { setShowCatalogos(false); handleMenuClick(); }} />
                      )}
                    </div>
                  );
                }

                if (item.path === '/poa/documentos') {
                  return (
                    <button
                      key={item.path}
                      type="button"
                      className={getItemClass(isActive(item.path), item.path)}
                      onClick={handleDocumentosClick}
                      title={item.name}
                    >
                      <Icon className="w-6 h-6 flex-shrink-0" />
                      {!collapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.name}</span>}
                    </button>
                  );
                }

                if (item.path === '/poa/documentos-revision') {
                  return (
                    <button
                      key={item.path}
                      type="button"
                      className={getItemClass(isActive(item.path), item.path)}
                      onClick={handleRevisionClick}
                      title={item.name}
                    >
                      <Icon className="w-6 h-6 flex-shrink-0" />
                      {!collapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.name}</span>}
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/poa'}
                    className={({ isActive: navActive }) => getItemClass(navActive, item.path)}
                    onClick={() => {
                      markSelected(item.path);
                      handleMenuClick();
                    }}
                    title={item.name}
                  >
                    <Icon className="w-6 h-6 flex-shrink-0" />
                    {!collapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.name}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="mt-auto p-4 border-t border-blue-800/50">
          <button
            onClick={() => navigate('/')}
            title="Panel de Modulos"
            className={`group flex items-center gap-4 w-full transition-all duration-300 rounded-lg ${collapsed ? 'justify-center h-14' : 'px-4 py-3'} text-blue-200 hover:bg-red-500/80 hover:text-white border border-transparent hover:border-red-300/30`}
          >
            <BackIcon className="w-6 h-6 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Panel de Modulos</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
