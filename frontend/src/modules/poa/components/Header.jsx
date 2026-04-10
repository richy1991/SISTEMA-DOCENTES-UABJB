import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaHome, FaArrowLeft, FaPlus, FaEdit, FaTrash, FaFilePdf, FaMoneyBillAlt, FaBullseye } from 'react-icons/fa';
import IconButton from './IconButton';

const themeStyles = {
  dark: {
    headerBg: 'bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950',
    headerHomeBg: 'bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950',
    headerShadow: 'shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    headerBorder: 'border-b border-blue-700/50',
    headerText: 'text-white',
    headerHomeText: 'text-white',
    muted: 'text-blue-200',
    primaryButton: 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600',
    buttonShadow: 'shadow-[0_8px_20px_rgba(37,99,235,0.4)]',
    buttonHover: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
    buttonText: 'text-white',
  },
  light: {
    headerBg: 'bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900',
    headerHomeBg: 'bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900',
    headerShadow: 'shadow-[0_4px_20px_rgba(30,58,138,0.3)]',
    headerBorder: 'border-b border-blue-600/30',
    headerText: 'text-white',
    headerHomeText: 'text-white',
    muted: 'text-blue-100',
    primaryButton: 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600',
    buttonShadow: 'shadow-[0_8px_20px_rgba(37,99,235,0.3)]',
    buttonHover: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
    buttonText: 'text-white',
  },
};

const Header = ({ 
  theme, 
  isHome, 
  showHeader, 
  headerSelectedActividad, 
  headerSelectedDireccion, 
  headerSelectedOperacion,
  onNavigate,
  sidebarExpanded = true,
  poaPermissions = {}
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'dark';
  const themeConfig = themeStyles[theme];
  const canEdit = !!poaPermissions?.canEdit;
  const canManageAccess = !!poaPermissions?.canManageAccess;

  const gradientButtonClasses = (size = 'md') => {
    const sizeMap = {
      md: 'py-1 px-4 text-sm md:text-sm rounded-lg',
      sm: 'py-0.5 px-3 text-xs rounded-full',
    };
    const sizeClasses = sizeMap[size] || sizeMap.md;
    return `${themeConfig.primaryButton} ${themeConfig.buttonText} font-bold ${sizeClasses} ${themeConfig.buttonShadow} ${themeConfig.buttonHover} transition duration-300`;
  };

  const getPageTitle = () => {
    const p = location?.pathname || '';
    if (p === '/poa/documentos' || p === '/poa') return 'Documentos POA';
    if (p === '/poa/documentos-revision') return 'Revisión de Documentos POA';
    if (p === '/poa/direcciones' || p === '/poa/catalogos/indicadores' || p === '/poa/catalogos/direcciones') return 'Catálogo de indicadores';
    if (p.startsWith('/poa/objetivos')) return 'Objetivos Específicos';
    if (p.startsWith('/poa/actividades')) return 'Actividades';
    if (p.startsWith('/poa/catalogos')) return 'Catálogos';
    if (p === '/poa/presupuestos') return 'Detalle Presupuesto';
    if (p === '/poa/reportes') return 'Reportes';
    if (p === '/poa/personas') return 'Personas';
    return 'Ingeniería de Sistemas';
  };

  const renderRightActions = () => {
    const p = location?.pathname || '';
    
    if (p.startsWith('/poa/objetivos-especificos')) {
      if (!canEdit) return null;
      return (
        <IconButton 
          showIcon 
          icon={<FaPlus />} 
          onClick={() => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'objetivos' } }))} 
          className={gradientButtonClasses()} 
          title="Nuevo"
        >
          Nuevo
        </IconButton>
      );
    }
    
    if (p === '/poa/documentos' || p === '/poa/documentos-revision') {
      return (
        <>
          <IconButton 
            showIcon 
            icon={<FaFilePdf />} 
            onClick={() => window.dispatchEvent(new CustomEvent('generate-pdf-documentos', { detail: {} }))} 
            className={`${gradientButtonClasses()} mr-2`} 
            title="Generar PDF"
          >
            PDF
          </IconButton>
          {p === '/poa/documentos' && canEdit && (
            <IconButton 
              showIcon 
              icon={<FaPlus />} 
              onClick={() => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'documentos' } }))} 
              className={gradientButtonClasses()} 
              title="Nuevo"
            >
              Nuevo
            </IconButton>
          )}
        </>
      );
    }
    
    if (p === '/poa/personas') {
      if (!canManageAccess) return null;
      return (
        <IconButton 
          showIcon 
          icon={<FaPlus />} 
          onClick={() => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'personas' } }))} 
          className={gradientButtonClasses()} 
          title="Nuevo"
        >
          Nuevo
        </IconButton>
      );
    }
    
    if (p === '/poa/direcciones' || p === '/poa/catalogos/indicadores' || p === '/poa/indicadores') {
      if (!canEdit) return null;
      if (headerSelectedDireccion) {
        return (
          <>
            {headerSelectedOperacion && (
              <>
                <IconButton 
                  showIcon 
                  icon={<FaEdit />} 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-edit-operacion', { detail: headerSelectedOperacion }))} 
                  className={gradientButtonClasses()} 
                  title="Editar"
                >
                  Editar
                </IconButton>
                <IconButton 
                  showIcon 
                  icon={<FaTrash />} 
                  onClick={() => {
                    const ok = window.confirm(`Eliminar operación ${headerSelectedOperacion.nombre || headerSelectedOperacion.operacion || headerSelectedOperacion.id}?`);
                    if (!ok) return;
                    window.dispatchEvent(new CustomEvent('delete-operacion', { detail: headerSelectedOperacion }));
                  }} 
                  className={gradientButtonClasses()} 
                  title="Eliminar"
                >
                  Eliminar
                </IconButton>
              </>
            )}
            <IconButton 
              showIcon 
              icon={<FaPlus />} 
              onClick={() => { 
                window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'indicadores' } })); 
              }} 
              className={gradientButtonClasses()} 
              title="Nuevo indicador"
            >
              Nuevo indicador
            </IconButton>
          </>
        );
      }
      return (
        <IconButton 
          showIcon 
          icon={<FaPlus />} 
          onClick={() => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'direcciones' } }))} 
          className={gradientButtonClasses()} 
          title="Nuevo"
        >
          Nuevo
        </IconButton>
      );
    }
    
    if (p.startsWith('/poa/actividades')) {
      return (
        <>
          {headerSelectedActividad && (
            <>
              {canEdit && (
                <IconButton 
                  showIcon 
                  icon={<FaEdit />} 
                  onClick={() => window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'edit', actividad: headerSelectedActividad } }))} 
                  className={gradientButtonClasses()} 
                  title="Editar"
                >
                  Editar
                </IconButton>
              )}
              <IconButton 
                showIcon 
                icon={<FaMoneyBillAlt />} 
                onClick={() => navigate('/poa/presupuestos', { state: { actividad: headerSelectedActividad } })} 
                title="Ver presupuesto" 
                className={gradientButtonClasses()}
              >
                Presupuesto
              </IconButton>
              {canEdit && (
                <IconButton 
                  showIcon 
                  icon={<FaTrash />} 
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'delete', actividad: headerSelectedActividad } }));
                  }} 
                  className={gradientButtonClasses()} 
                  title="Eliminar"
                >
                  Eliminar
                </IconButton>
              )}
            </>
          )}
          {canEdit && (
            <IconButton 
              showIcon 
              icon={<FaPlus />} 
              onClick={() => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'actividades' } }))} 
              className={gradientButtonClasses()} 
              title="Nuevo"
            >
              Nuevo
            </IconButton>
          )}
        </>
      );
    }
    
    if (p.startsWith('/poa/presupuestos')) {
      return (
        <>
          {headerSelectedActividad && (
            <>
              {canEdit && (
                <>
                  <IconButton 
                    showIcon 
                    icon={<FaEdit />} 
                    onClick={() => window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'edit', actividad: headerSelectedActividad } }))} 
                    className={gradientButtonClasses()} 
                    title="Editar"
                  >
                    Editar
                  </IconButton>
                  <IconButton 
                    showIcon 
                    icon={<FaTrash />} 
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'delete', actividad: headerSelectedActividad } }));
                    }} 
                    className={gradientButtonClasses()} 
                    title="Eliminar"
                  >
                    Eliminar
                  </IconButton>
                </>
              )}
            </>
          )}
          {canEdit && (
            <IconButton 
              showIcon 
              icon={<FaPlus />} 
              onClick={() => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'presupuestos' } }))} 
              className={gradientButtonClasses()} 
              title="Nuevo"
            >
              Nuevo
            </IconButton>
          )}
        </>
      );
    }
    
    return null;
  };

  if (isHome) {
    return (
      <header className={`w-full ${themeConfig.headerHomeBg} ${themeConfig.headerHomeText} flex justify-between items-center px-8 py-6 ${themeConfig.headerShadow} ${themeConfig.headerBorder}`}>
        <div />
        <div className="text-2xl font-bold tracking-wide">Ingeniería de Sistemas</div>
        <div className="flex flex-col items-end gap-1">
          <div className={`text-base ${themeConfig.muted}`}>Bienvenido</div>
          <div className={`text-xs ${themeConfig.muted}`}>Windows</div>
        </div>
      </header>
    );
  }

  const sidebarOffset = sidebarExpanded ? 'md:left-72' : 'md:left-16';
  const headerWidthClass = sidebarExpanded ? 'md:w-[calc(100%-18rem)]' : 'md:w-[calc(100%-4rem)]';

  return (
    <header className={`${themeConfig.headerBg} ${themeConfig.headerText} flex flex-wrap items-center gap-y-3 px-4 pl-16 md:px-6 py-3 md:py-4 fixed top-0 right-0 left-0 z-30 w-full ${headerWidthClass} transform transition-all duration-300 ease-in-out ${sidebarOffset} ${showHeader ? `translate-y-0 opacity-100 ${themeConfig.headerShadow} ${themeConfig.headerBorder}` : '-translate-y-full opacity-0 pointer-events-none'}`}>
      {/* Left: home icon + page controls */}
      <div className="flex shrink-0 items-center gap-2 md:mr-4">
        <button onClick={() => navigate('/poa')} className={gradientButtonClasses()} title="Ir al inicio">
          <FaHome className="text-white" size={22} />
        </button>
        {(() => {
          const p = location?.pathname || '';
          if (p.startsWith('/poa/objetivos-especificos') || p.startsWith('/poa/actividades') || p.startsWith('/poa/presupuestos')) {
            return (
              <IconButton 
                showIcon 
                icon={<FaArrowLeft />} 
                onClick={() => navigate(-1)} 
                className={gradientButtonClasses()} 
                title="Volver"
              >
                Volver
              </IconButton>
            );
          }
          return null;
        })()}
      </div>

      {/* Center: page title */}
      <div className="order-3 basis-full min-w-0 px-0 text-left md:order-none md:flex-1 md:px-4 md:text-center">
        <h1 className="text-xl md:text-2xl font-bold truncate">{getPageTitle()}</h1>
      </div>

      {/* Right: actions */}
      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
        {renderRightActions()}
      </div>
    </header>
  );
};

export default Header;
