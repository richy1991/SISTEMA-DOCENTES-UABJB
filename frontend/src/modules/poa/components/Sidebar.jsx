import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FaChevronDown, FaBars, FaHome, FaUsers, FaMapMarkerAlt, FaFileAlt, FaList, FaChartBar, FaFilePdf } from 'react-icons/fa';
import IconButton from './IconButton';
import CatalogosMenu from '../pages/CatalogosMenu';
import ProfilePicture from '../../../components/ProfilePicture';

const getRoleName = (user) => {
  if (!user?.perfil?.rol) {
    return user?.is_staff ? 'Administrador' : 'Usuario';
  }
  const roles = {
    admin: 'Administrador',
    director: 'Director de Carrera',
    jefe_estudios: 'Jefe de Estudios',
    docente: 'Docente',
    coordinador: 'Coordinador POA',
  };
  return roles[user.perfil.rol] || 'Usuario';
};

const getFullName = (user) => {
  const first = user?.first_name || '';
  const last = user?.last_name || '';
  const full = `${first} ${last}`.trim();
  return full || user?.username || 'Usuario';
};

const themeStyles = {
  dark: {
    rootBg: 'bg-gradient-to-b from-[#020617] via-[#050a16] to-[#070b17]',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    // Colores del sistema principal - Sidebar azul
    sidebarBg: 'bg-gradient-to-b from-blue-900 to-blue-950',
    sidebarBorder: 'border-blue-800/50',
    navCardBg: 'bg-blue-800/20',
    navCardShadow: 'shadow-[0_10px_40px_rgba(0,0,0,0.3)]',
    navActiveBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    navActiveBorder: 'border-white',
    navActiveText: 'text-white',
    navItemHover: 'hover:bg-blue-800/50 hover:text-white',
    buttonShadow: 'shadow-[0_8px_25px_rgba(14,165,233,0.45)]',
    buttonHover: 'hover:from-[#06b6d4] hover:via-[#3b82f6] hover:to-[#7c3aed]',
    buttonText: 'text-white',
    primaryButton: 'bg-gradient-to-r from-[#22d3ee] via-[#0ea5e9] to-[#6366f1]',
    toggleBg: 'bg-gradient-to-br from-[#22d3ee] via-[#0ea5e9] to-[#6366f1]',
    toggleText: 'text-white',
    hamburgerBg: 'bg-gradient-to-br from-[#22d3ee]/90 via-[#0ea5e9]/70 to-[#2563eb]/80 text-white p-3 rounded-full shadow-[0_10px_25px_rgba(34,211,238,0.45)] border border-[#22d3ee]/60 backdrop-blur',
    closeBg: 'bg-gradient-to-br from-[#0f172a] to-[#111928]',
    profileText: 'text-blue-200',
  },
  light: {
    rootBg: 'bg-gradient-to-b from-[#f5f7ff] via-[#edf2ff] to-[#e0e7ff]',
    text: 'text-slate-900',
    muted: 'text-slate-500',
    // Colores del sistema principal - Sidebar azul (mismo en light mode)
    sidebarBg: 'bg-gradient-to-b from-blue-900 to-blue-950',
    sidebarBorder: 'border-blue-800/50',
    navCardBg: 'bg-blue-800/20',
    navCardShadow: 'shadow-[0_10px_40px_rgba(0,0,0,0.3)]',
    navActiveBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    navActiveBorder: 'border-white',
    navActiveText: 'text-white',
    navItemHover: 'hover:bg-blue-800/50 hover:text-white',
    buttonShadow: 'shadow-[0_10px_30px_rgba(29,78,216,0.25)]',
    buttonHover: 'hover:from-[#3b82f6] hover:via-[#2563eb] hover:to-[#1d4ed8]',
    buttonText: 'text-white',
    primaryButton: 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600',
    toggleBg: 'bg-white border border-slate-300',
    toggleText: 'text-slate-900',
    hamburgerBg: 'bg-white/90 border border-blue-300 text-slate-900 p-3 rounded-full shadow-lg',
    closeBg: 'bg-slate-100 text-slate-900',
    profileText: 'text-blue-200',
  },
};

const menuItems = [
  { name: 'Inicio', icon: <FaHome />, path: '.' },
  { name: 'Personas', icon: <FaUsers />, path: './personas' },
  { name: 'Documentos POA', icon: <FaFileAlt />, path: './documentos' },
  { name: 'Catálogos', icon: <FaList />, path: './catalogos' },
  { name: 'Detalle Presupuesto', icon: <FaChartBar />, path: './presupuestos' },
  { name: 'Reportes', icon: <FaFilePdf />, path: './reportes' },
];

const Sidebar = ({ theme, onNavigate, showGestionModal, setShowGestionModal, sidebarExpanded, setSidebarExpanded, user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(sidebarExpanded);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [manualExpand, setManualExpand] = useState(false);
  const [showCatalogos, setShowCatalogos] = useState(false);
  const sidebarRef = useRef();

  // Debug: ver estructura del usuario
  console.log('Sidebar user:', user);

  const isDark = theme === 'dark';
  const themeConfig = themeStyles[theme];
  const isHome = location?.pathname === '/poa' || location?.pathname === '/poa/';

  const expanded = sidebarOpen || sidebarHover;

  // Al entrar al homepage expandir; al salir, colapsar automáticamente
  useEffect(() => {
    if (isHome) {
      setSidebarOpen(true);
      setManualExpand(true);
    } else {
      setSidebarOpen(false);
      setManualExpand(false);
      setSidebarHover(false);
    }
  }, [isHome]);

  // Notificar al padre sobre el estado expanded real (incluye hover)
  useEffect(() => {
    setSidebarExpanded(expanded);
  }, [expanded, setSidebarExpanded]);
  const navSpacing = expanded ? 'gap-3 px-6 py-3' : 'justify-center py-3';
  const navTextClass = 'text-blue-200';
  const navItemBase = `flex items-center ${navSpacing} rounded-xl border border-transparent font-semibold w-full text-left transition duration-300`;
  const navActiveShadow = 'shadow-lg';
  const catalogActiveShadow = 'shadow-[0_0_20px_rgba(59,130,246,0.35)]';
  const sidebarShadow = 'shadow-2xl';
  const navIconClass = isDark ? 'text-blue-200' : 'text-blue-200';
  const chevronColor = isDark ? 'text-blue-300' : 'text-blue-300';

  const gradientButtonClasses = (size = 'md') => {
    const sizeMap = {
      md: 'py-1 px-4 text-sm md:text-sm rounded-lg',
      sm: 'py-0.5 px-3 text-xs rounded-full',
    };
    const sizeClasses = sizeMap[size] || sizeMap.md;
    return `${themeConfig.primaryButton} ${themeConfig.buttonText} font-bold ${sizeClasses} ${themeConfig.buttonShadow} ${themeConfig.buttonHover} transition duration-300`;
  };

  const handleMenuClick = () => {
    // Cerrar sidebar al navegar
    setSidebarOpen(false);
    setManualExpand(false);
  };

  const handleSidebarToggle = () => {
    const newOpen = !sidebarOpen;
    setSidebarOpen(newOpen);
    setSidebarExpanded(newOpen);
    setManualExpand(newOpen);
  };

  // Hover solo en páginas distintas al home
  const handleMouseEnter = () => { if (!isHome) setSidebarHover(true); };
  const handleMouseLeave = () => { if (!isHome) setSidebarHover(false); };

  // Botón toggle solo visible en homepage
  const showHamburger = isHome && !sidebarOpen && !sidebarHover;
  const showClose = isHome && expanded && manualExpand;

  return (
    <>
      {/* Botón hamburguesa flotante */}
      {showHamburger && (
        <button
          className={`fixed top-4 left-4 z-50 ${themeConfig.hamburgerBg} p-3 rounded-full transition`}
          onClick={handleSidebarToggle}
        >
          <FaBars size={24} />
        </button>
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-screen ${expanded ? 'w-72' : 'w-16'} ${themeConfig.sidebarBg} ${themeConfig.text} flex flex-col items-center py-8 ${sidebarShadow} ${themeConfig.sidebarBorder} z-40 transition-all duration-300`}
        style={{ minHeight: '100vh' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Botón para retraer */}
        {showClose && (
          <button
            className={`absolute top-4 right-4 ${themeConfig.closeBg} text-blue-200 border border-blue-400/60 shadow-[0_6px_18px_rgba(14,165,233,0.5)] hover:brightness-110 p-2 rounded-full transition`}
            onClick={handleSidebarToggle}
            title="Ocultar menú"
          >
            <span className="text-lg font-bold">×</span>
          </button>
        )}

        {/* Avatar header con datos del usuario */}
        {expanded ? (
          <div className="flex flex-col items-center px-4 mb-4">
            <div className="w-20 h-20 mb-3">
              <ProfilePicture user={user} onUpdate={() => {}} />
            </div>
            <div className={`text-base font-bold ${themeConfig.profileText} text-center leading-tight`}>
              {getFullName(user)}
            </div>
            <div className="text-xs text-blue-300 text-center mt-0.5">
              {getRoleName(user)}
            </div>
            {user?.email && (
              <div className="text-xs text-blue-400/80 text-center mt-0.5 truncate max-w-full" title={user.email}>
                {user.email}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-10 flex justify-center">
            <div className="w-10 h-10">
              <ProfilePicture user={user} onUpdate={() => {}} />
            </div>
          </div>
        )}

        {!expanded && (
          <div className="mb-6" />
        )}

        {/* Navegación */}
        <nav className={`w-full mb-6 flex flex-col gap-1 rounded-2xl ${themeConfig.navCardBg} ${themeConfig.navCardShadow} ${expanded ? '' : 'items-center'}`}>
          {menuItems.map(item => {
            if (item.name === 'Catálogos') {
              return (
                <div key={item.name} className="w-full">
                  <button
                    className={showCatalogos && expanded ? `${navItemBase} ${themeConfig.navActiveBg} ${themeConfig.navActiveBorder} ${themeConfig.navActiveText} ${catalogActiveShadow}` : `${navItemBase} ${navTextClass} ${themeConfig.navItemHover}`}
                    onClick={() => expanded ? setShowCatalogos(!showCatalogos) : handleSidebarToggle()}
                    title={item.name}
                  >
                    <span className={`text-xl ${navIconClass}`}>{item.icon}</span>
                    {expanded && <span>{item.name}</span>}
                    {expanded && <FaChevronDown className={`ml-auto transition-transform duration-300 ${showCatalogos ? 'rotate-180' : ''} ${chevronColor}`} />}
                  </button>
                  {showCatalogos && expanded && (
                    <CatalogosMenu onMenuClick={() => { setShowCatalogos(false); handleMenuClick(); }} />
                  )}
                </div>
              );
            }

            if (item.name === 'Documentos POA') {
              return (
                <button
                  key={item.name}
                  className={`${navItemBase} ${navTextClass} ${themeConfig.navItemHover}`}
                  onClick={() => { setShowGestionModal(true); }}
                  title={item.name}
                >
                  <span className={`text-xl ${navIconClass}`}>{item.icon}</span>
                  {expanded && <span>{item.name}</span>}
                </button>
              );
            }

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `${navItemBase} ${isActive ? `${themeConfig.navActiveBg} ${themeConfig.navActiveBorder} ${themeConfig.navActiveText} ${navActiveShadow}` : `${navTextClass} ${themeConfig.navItemHover}`}`
                }
                onClick={handleMenuClick}
                title={item.name}
              >
                <span className={`text-xl ${navIconClass}`}>{item.icon}</span>
                {expanded && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
