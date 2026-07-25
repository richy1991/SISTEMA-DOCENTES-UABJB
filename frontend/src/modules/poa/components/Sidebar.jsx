import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaChevronDown, FaBars, FaHome, FaUsers, FaFileAlt, FaList, FaFilePdf, FaClipboardCheck } from 'react-icons/fa';
import CatalogosMenu from '../pages/CatalogosMenu';
import ProfilePicture from '../../../components/ProfilePicture';

const BackIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const getRoleName = (user) => {
  if (user?.is_superuser) {
    return 'Super Admin';
  }
  if (!user?.perfil?.rol) {
    return user?.is_staff ? 'Administrador' : 'Usuario';
  }
  const roles = {
    iiisyp: 'Instituto de investigación',
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

const themeStyles = {
  dark: {
    text: 'text-slate-100',
    // Colores del sistema principal - Sidebar azul
    sidebarBg: 'bg-gradient-to-b from-blue-900 to-blue-950',
    sidebarBorder: 'border-blue-800/50',
    navCardBg: 'bg-blue-800/20',
    navCardShadow: 'shadow-[0_10px_40px_rgba(0,0,0,0.3)]',
    navActiveBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    navActiveBorder: 'border-white',
    navActiveText: 'text-white',
    navItemHover: 'hover:bg-blue-800/50 hover:text-white',
    profileText: 'text-blue-200',
  },
  light: {
    text: 'text-slate-900',
    // Colores del sistema principal - Sidebar azul (mismo en light mode)
    sidebarBg: 'bg-gradient-to-b from-blue-900 to-blue-950',
    sidebarBorder: 'border-blue-800/50',
    navCardBg: 'bg-blue-800/20',
    navCardShadow: 'shadow-[0_10px_40px_rgba(0,0,0,0.3)]',
    navActiveBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    navActiveBorder: 'border-white',
    navActiveText: 'text-white',
    navItemHover: 'hover:bg-blue-800/50 hover:text-white',
    profileText: 'text-blue-200',
  },
};

const menuItems = [
  { name: 'Inicio', icon: <FaHome />, path: '/poa' },
  { name: 'Accesos POA', icon: <FaUsers />, path: '/poa/accesos' },
  { name: 'Documentos POA', icon: <FaFileAlt />, path: '/poa/documentos' },
  { name: 'Revisión POA', icon: <FaClipboardCheck />, path: '/poa/documentos-revision' },
  { name: 'Catálogos', icon: <FaList />, path: '/poa/catalogos' },
  { name: 'Reportes', icon: <FaFilePdf />, path: '/poa/reportes' },
];

const DESKTOP_BREAKPOINT = 768;

const getIsDesktopViewport = () => {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= DESKTOP_BREAKPOINT;
};

const Sidebar = ({ theme, onOpenGestionSelector, onOpenRevisionBoard, setSidebarExpanded, user, poaPermissions = {}, poaRoles = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(getIsDesktopViewport);
  const [sidebarOpen, setSidebarOpen] = useState(getIsDesktopViewport);
  const [showCatalogos, setShowCatalogos] = useState(false);

  const isDark = theme === 'dark';
  const themeConfig = themeStyles[theme];
  const canManageAccess = !!poaPermissions?.canManageAccess;
  const expanded = sidebarOpen;

  useEffect(() => {
    const handleResize = () => {
      const nextIsDesktop = getIsDesktopViewport();
      setIsDesktop(nextIsDesktop);
      setSidebarOpen((currentOpen) => {
        if (nextIsDesktop) {
          return currentOpen;
        }
        return false;
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Notificar al padre solo para layout de escritorio
  useEffect(() => {
    setSidebarExpanded(isDesktop ? expanded : false);
  }, [expanded, isDesktop, setSidebarExpanded]);
  const navSpacing = isDesktop
    ? (expanded ? 'gap-3 px-6 py-3' : 'justify-center py-3')
    : 'gap-2 px-3 py-2.5';
  const navTextClass = 'text-blue-200';
  const navItemBase = `flex items-center ${navSpacing} rounded-xl border border-transparent font-semibold w-full text-left transition duration-300 ${isDesktop ? '' : 'text-sm'}`;
  const navActiveShadow = 'shadow-lg';
  const catalogActiveShadow = 'shadow-[0_0_20px_rgba(59,130,246,0.35)]';
  const sidebarShadow = 'shadow-2xl';
  const navIconClass = isDark ? 'text-blue-200' : 'text-blue-200';
  const chevronColor = isDark ? 'text-blue-300' : 'text-blue-300';

  const handleMenuClick = () => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  };

  const handleSidebarToggle = () => {
    setSidebarOpen((currentOpen) => !currentOpen);
  };

  const handleDocumentosClick = () => {
    handleMenuClick();
    onOpenGestionSelector?.();
  };

  const handleRevisionClick = () => {
    handleMenuClick();
    onOpenRevisionBoard?.();
  };

  const showHamburger = !expanded;
  const showClose = expanded;
  const sidebarStyle = isDesktop
    ? { minHeight: '100vh' }
    : { minHeight: '100vh', width: 'min(74vw, 17rem)', maxWidth: '17rem' };

  return (
    <>
      {!isDesktop && expanded && (
        <div
          className="poa-sidebar-backdrop fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Botón hamburguesa flotante */}
      {showHamburger && (
        <button
          className="poa-sidebar-toggle fixed top-3 left-4 z-50 p-2 text-blue-200 hover:text-white transition-all duration-300"
          onClick={handleSidebarToggle}
          title="Expandir menú"
        >
          <FaBars size={24} />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`poa-sidebar fixed left-0 top-0 h-screen overflow-hidden ${isDesktop ? (expanded ? 'w-72' : 'w-16') : ''} ${themeConfig.sidebarBg} ${themeConfig.text} flex flex-col items-center py-4 ${sidebarShadow} ${themeConfig.sidebarBorder} z-40 transition-all duration-300 ${isDesktop ? 'translate-x-0' : expanded ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={sidebarStyle}
      >
        {/* Botón para retraer - en flujo normal, no absolute */}
        <div className="poa-sidebar-close-row w-full flex justify-end px-3 mb-2 min-h-[2rem] shrink-0">
          {showClose && (
            <button
              className="text-blue-200 hover:text-white p-1 rounded transition leading-none"
              onClick={handleSidebarToggle}
              title="Ocultar menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Avatar header con datos del usuario */}
        {expanded ? (
          <div className={`poa-sidebar-profile flex flex-col items-center shrink-0 ${isDesktop ? 'px-4 mb-4' : 'px-3 mb-3'}`}>
            <div className={`${isDesktop ? 'w-40 h-40 mb-3' : 'w-20 h-20 mb-2'}`}>
              <ProfilePicture user={user} onUpdate={() => {}} />
            </div>
            <div className={`${isDesktop ? 'text-base' : 'text-sm'} font-bold ${themeConfig.profileText} text-center leading-tight`}>
              {getFullName(user)}
            </div>
            <div className={`${isDesktop ? 'text-xs' : 'text-[11px]'} text-blue-300 text-center mt-0.5`}>
              {getRoleName(user)}
            </div>
            <div className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} text-cyan-200 text-center mt-1 font-semibold px-2 leading-tight`}>
              Rol POA: {getPoaRoleLabel(poaRoles)}
            </div>
          </div>
        ) : (
          <div className="mb-10 flex justify-center">
            <div className="w-12 h-12">
              <ProfilePicture user={user} onUpdate={() => {}} />
            </div>
          </div>
        )}

        {!expanded && (
          <div className="mb-6" />
        )}

        {/* Navegación */}
        <nav className={`poa-sidebar-nav w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${isDesktop ? 'mb-6' : 'mb-3'} flex flex-col gap-1 rounded-2xl ${themeConfig.navCardBg} ${themeConfig.navCardShadow} ${expanded ? '' : 'items-center'}`}>
          {menuItems.filter((item) => (item.path === '/poa/accesos' ? canManageAccess : true)).map(item => {
            if (item.name === 'Catálogos') {
              return (
                <div key={item.name} className="w-full">
                  <button
                    className={showCatalogos && expanded ? `${navItemBase} ${themeConfig.navActiveBg} ${themeConfig.navActiveBorder} ${themeConfig.navActiveText} ${catalogActiveShadow}` : `${navItemBase} ${navTextClass} ${themeConfig.navItemHover}`}
                    onClick={() => {
                      if (!expanded) {
                        handleSidebarToggle();
                        return;
                      }
                      setShowCatalogos(!showCatalogos);
                    }}
                    title={item.name}
                  >
                    <span className={`${isDesktop ? 'text-xl' : 'text-base'} ${navIconClass}`}>{item.icon}</span>
                    {expanded && <span>{item.name}</span>}
                    {expanded && <FaChevronDown className={`ml-auto transition-transform duration-300 ${showCatalogos ? 'rotate-180' : ''} ${chevronColor}`} />}
                  </button>
                  {showCatalogos && expanded && (
                    <CatalogosMenu onMenuClick={() => { setShowCatalogos(false); handleMenuClick(); }} />
                  )}
                </div>
              );
            }

            if (item.path === '/poa/documentos') {
              const isActive = location?.pathname === item.path;
              return (
                <button
                  key={item.name}
                  type="button"
                  className={`${navItemBase} ${isActive ? `${themeConfig.navActiveBg} ${themeConfig.navActiveBorder} ${themeConfig.navActiveText} ${navActiveShadow}` : `${navTextClass} ${themeConfig.navItemHover}`}`}
                  onClick={handleDocumentosClick}
                  title={item.name}
                >
                  <span className={`${isDesktop ? 'text-xl' : 'text-base'} ${navIconClass}`}>{item.icon}</span>
                  {expanded && <span>{item.name}</span>}
                </button>
              );
            }

            if (item.path === '/poa/documentos-revision') {
              const isActive = location?.pathname === item.path;
              return (
                <button
                  key={item.name}
                  type="button"
                  className={`${navItemBase} ${isActive ? `${themeConfig.navActiveBg} ${themeConfig.navActiveBorder} ${themeConfig.navActiveText} ${navActiveShadow}` : `${navTextClass} ${themeConfig.navItemHover}`}`}
                  onClick={handleRevisionClick}
                  title={item.name}
                >
                  <span className={`${isDesktop ? 'text-xl' : 'text-base'} ${navIconClass}`}>{item.icon}</span>
                  {expanded && <span>{item.name}</span>}
                </button>
              );
            }
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/poa'}
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? `${themeConfig.navActiveBg} ${themeConfig.navActiveBorder} ${themeConfig.navActiveText} ${navActiveShadow}` : `${navTextClass} ${themeConfig.navItemHover}`}`
                }
                onClick={handleMenuClick}
                title={item.name}
              >
                <span className={`${isDesktop ? 'text-xl' : 'text-base'} ${navIconClass}`}>{item.icon}</span>
                {expanded && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Botón regresar al panel de módulos */}
        <div className={`poa-sidebar-footer mt-auto w-full shrink-0 border-t border-blue-800/50 ${expanded ? 'px-3 py-3' : 'flex justify-center py-3'}`}>
          <button
            onClick={() => navigate('/')}
            title="Panel de Módulos"
            className={`group flex items-center gap-3 w-full transition-all duration-300 rounded-xl ${expanded ? 'px-4 py-3' : 'justify-center h-12 w-12'} text-blue-200 hover:bg-red-500/80 hover:text-white`}
          >
            <BackIcon className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="font-medium text-sm whitespace-nowrap">Panel de Módulos</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
