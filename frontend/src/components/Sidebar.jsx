import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaArchive,
  FaArrowLeft,
  FaBookOpen,
  FaCalendarAlt,
  FaClock,
  FaExchangeAlt,
  FaGraduationCap,
  FaHome,
} from 'react-icons/fa';
import ProfilePicture from './ProfilePicture';
import ThemeToggle from './ThemeToggle';
import { useActiveRole } from '../contexts/ActiveRoleContext';

function Sidebar({ user, onLogout, collapsed, setCollapsed, theme, setTheme, onProfileUpdate, onCarreraActivaChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    effectiveUser,
  } = useActiveRole();
  const currentUser = effectiveUser || user;

  // 📱 RESPONSIVE AUTOMÁTICO: colapsar el sidebar en pantallas pequeñas (modo teléfono)
  // para liberar espacio. Cuando se agranda la pantalla, se mantiene el estado del usuario.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const handleMediaChange = (e) => {
      setCollapsed(e.matches);
    };

    // Aplicar el estado inicial según el tamaño actual de la pantalla
    setCollapsed(mediaQuery.matches);

    // Escuchar cambios de tamaño de pantalla
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, [setCollapsed]);

  const isActive = (path) => {
    if (path === '/fondo-tiempo') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

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
    };
    return roles[user.perfil.rol] || 'Usuario';
  };

  // Define los roles que pueden ver cada item.
  // iiisyp es solo lectura: no ve items de administracion
  const menuItems = {
    principal: [
      { path: '/fondo-tiempo', icon: FaHome, label: 'Dashboard', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'] },
      { path: '/fondo-tiempo/comparar', icon: FaExchangeAlt, label: 'Comparar Fondos', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'] },
      { path: '/fondo-tiempo/archivados', icon: FaArchive, label: 'Fondos Archivados', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'] },
    ],
    administracion: [
      { path: '/fondo-tiempo/docentes', icon: FaGraduationCap, label: 'Docentes', roles: ['iiisyp', 'director', 'jefe_estudios'] },
      { path: '/fondo-tiempo/cargas-horarias', icon: FaClock, label: 'Carga Horaria', roles: ['jefe_estudios'] },
      { path: '/fondo-tiempo/calendarios', icon: FaCalendarAlt, label: 'Calendario Académico', superuser: true },
      { path: '/fondo-tiempo/materias', icon: FaBookOpen, label: 'Materias', roles: ['director', 'jefe_estudios'], superuser: true },
    ]
  };

  // Determina el rol del usuario actual.
  const userRole = currentUser?.perfil?.rol;

  // Función helper para filtrar items
  const filterItems = (items) => items.filter(item => (
    (item.roles && userRole && item.roles.includes(userRole))
    || (item.superuser && currentUser?.is_superuser)
  ));

  const visiblePrincipal = filterItems(menuItems.principal);
  const visibleAdmin = filterItems(menuItems.administracion);

  return (
    <>
      {/* --- BARRA LATERAL PRINCIPAL --- */}
      <div
        className={`fixed left-0 top-0 h-screen bg-blue-900 text-white shadow-2xl z-40 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-20' : 'w-72'
        }`}
        style={{ fontFamily: '"Nunito Sans", "Segoe UI", Helvetica, Arial, sans-serif' }}
      >
        {/* --- BOTÓN TOGGLE (HAMBURGUESA) --- */}
        <div className={`flex mb-1 pt-2 ${collapsed ? 'justify-center' : 'justify-end px-3'}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className="p-2 text-blue-200 hover:text-white transition-all duration-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* --- 1. CABECERA CON PERFIL DE USUARIO --- */}
        <div className="ft-sidebar-profile-section px-4 pb-4">
          {/* Perfil de usuario */}
          <div className={`flex flex-col items-center gap-3 p-2 rounded-lg transition-all duration-300`}>
            <div className={`transition-all duration-300 ${collapsed ? 'w-12 h-12' : 'w-40 h-40'}`}>
              <ProfilePicture user={currentUser} onUpdate={onProfileUpdate} className="!bg-transparent !shadow-none" />
            </div>
            {/* Nombre y Rol (visible solo si no está colapsado) */}
            {!collapsed && (
              <div className="flex-1 min-w-0 text-center">
                <p className="text-sm font-normal text-white truncate" title={currentUser?.first_name || currentUser?.username}>
                  {currentUser?.first_name || currentUser?.username}
                </p>
                <p className="text-xs text-blue-300 truncate" title={getRoleName(currentUser)}>{getRoleName(currentUser)}</p>
              </div>
            )}
          </div>

        </div>

        {/* --- 2. NAVEGACIÓN PRINCIPAL (CON SCROLL) --- */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {/* Sección Principal */}
          <div className="mb-6">
            {!collapsed && (
              <h3 className="px-6 text-xs font-normal uppercase tracking-wider mb-2 text-blue-400">
                Principal
              </h3>
            )}
            <div className={collapsed ? "space-y-2 px-2" : "space-y-2 pl-4 pr-0"}>
              {visiblePrincipal.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`group flex items-center gap-4 w-full transition-all duration-300 ${
                    collapsed ? 'justify-center h-14' : 'px-4 py-3'
                  } ${
                    isActive(item.path)
                      ? 'rounded-l-xl rounded-r-none bg-blue-700/90 text-white shadow-[inset_4px_0_0_0_#ffffff,0_10px_24px_rgba(0,0,0,0.16)]'
                    : 'rounded-xl text-blue-200 hover:bg-blue-800/50 hover:text-white hover:shadow-[inset_4px_0_0_0_#ffffff]'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="font-normal text-sm whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              ))}

              {/* SECCIÓN ADMINISTRACIÓN */}
              {visibleAdmin.length > 0 && (
                <>
                  {!collapsed && (
                    <div className="text-xs font-normal text-blue-400 mt-4 mb-2 px-4 uppercase tracking-wider">
                      Administración
                    </div>
                  )}
                  {visibleAdmin.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      className={`group flex items-center gap-4 w-full transition-all duration-300 ${
                        collapsed ? 'justify-center h-14' : 'px-4 py-3'
                      } ${
                        isActive(item.path)
                          ? 'rounded-l-xl rounded-r-none bg-blue-700/90 text-white shadow-[inset_4px_0_0_0_#ffffff,0_10px_24px_rgba(0,0,0,0.16)]'
                          : 'rounded-xl text-blue-200 hover:bg-blue-800/50 hover:text-white hover:shadow-[inset_4px_0_0_0_#ffffff]'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="font-normal text-sm whitespace-nowrap">{item.label}</span>
                      )}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>

        </nav>

        {/* --- 3. PIE DE PÁGINA CON BOTÓN "ATRÁS" Y TOGGLE DE TEMA --- */}
        <div className="ft-sidebar-footer mt-auto p-4">
          <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'gap-3'}`}>
            {/* Botón Atrás */}
            <button
              onClick={() => navigate('..')}
              title="Atrás"
              className={`group flex items-center gap-4 transition-all duration-300 rounded-lg text-blue-200 hover:bg-red-500/80 hover:text-white ${
                collapsed ? 'justify-center w-11 h-11' : 'px-4 py-3 flex-1'
              }`}
            >
              <FaArrowLeft className="w-6 h-6 flex-shrink-0" />
              {!collapsed && (
                <span className="font-normal text-sm whitespace-nowrap">Atrás</span>
              )}
            </button>

            {/* Divisor */}
            {!collapsed ? (
              <div className="w-px h-8 bg-blue-700/60 mx-1"></div>
            ) : (
              <div className="w-8 h-px bg-blue-700/60 my-1"></div>
            )}

            {/* Toggle de Tema */}
            <ThemeToggle theme={theme} setTheme={setTheme} variant="inline" />
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
