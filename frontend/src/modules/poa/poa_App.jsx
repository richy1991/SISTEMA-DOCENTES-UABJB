import { Routes, Route, Outlet } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import { useTheme } from '../../useTheme';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ThemeToggle from '../../components/ThemeToggle';
import GestionSelectorModal from './components/GestionSelectorModal';
import NuevoIndicadorModal from './components/NuevoIndicadorModal';
import POAHomePage from './pages/POAHomePage';
import AccesosPOAPage from './pages/AccesosPOAPage';
import DocumentosPOAPage from './pages/DocumentosPOAPage';
import ActividadesPage from './pages/ActividadesPage';
import ObjetivosEspecificosPage from './pages/ObjetivosEspecificosPage';
import CatalogoItems from './pages/CatalogoItems';
import CatalogosMenu from './pages/CatalogosMenu';
import Reportes from './pages/Reportes';
import PresupuestosPage from './pages/PresupuestosPage';
import { getUsuariosPOA, getPendingDirectorReviews } from '../../apis/poa.api';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem('theme') || 'dark';
};

function POAApp({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTheme: theme, setTheme } = useTheme();
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [showNuevoIndicadorModal, setShowNuevoIndicadorModal] = useState(false);
  const [editOperacion, setEditOperacion] = useState(null);
  const [headerSelectedActividad, setHeaderSelectedActividad] = useState(null);
  const [headerSelectedDireccion, setHeaderSelectedDireccion] = useState(null);
  const [headerSelectedOperacion, setHeaderSelectedOperacion] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const [forceShowHeader, setForceShowHeader] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [poaRoles, setPoaRoles] = useState([]);
  const [pendingReviews, setPendingReviews] = useState(0);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef(null);

  const isHome = location?.pathname === '/poa' || location?.pathname === '/poa/';
  const isActividadesPage = location?.pathname?.includes('/poa/actividades/');
  const isPresupuestosPage = location?.pathname?.startsWith('/poa/presupuestos');
  const isObjetivosPage = location?.pathname?.startsWith('/poa/objetivos-especificos');

  useEffect(() => {
    let mounted = true;
    if (!user?.id) {
      setPoaRoles([]);
      return undefined;
    }
    getUsuariosPOA({ activo: true })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const docenteId = Number(user?.perfil?.docente || 0);
        const propios = list.filter((a) => {
          const byUser = Number(a?.user) === Number(user.id) || Number(a?.user_detalle?.id) === Number(user.id);
          const byDocente = docenteId > 0 && (Number(a?.docente) === docenteId || Number(a?.docente_detalle?.id) === docenteId);
          return byUser || byDocente;
        });
        let roles = [...new Set(propios.map((a) => a?.rol).filter(Boolean))];

        setPoaRoles(roles);
      })
      .catch(() => {
        if (mounted) setPoaRoles([]);
      });

    return () => { mounted = false; };
  }, [user?.id]);

  // Fetch pending reviews for director
  useEffect(() => {
    if (!user?.perfil?.rol || user.perfil.rol !== 'director') {
      setPendingReviews(0);
      return;
    }
    const currentYear = new Date().getFullYear();
    getPendingDirectorReviews(currentYear)
      .then((res) => setPendingReviews(res.data.count || 0))
      .catch(() => setPendingReviews(0));
  }, [user]);

  // Admin principal POA: superusuario global o administrador de carrera (iiisyp)
  const isAdminPrincipal = Boolean(user?.is_superuser || user?.perfil?.rol === 'iiisyp');

  const poaPermissions = {
    canEdit: poaRoles.includes('elaborador'),
    canManageAccess: poaRoles.includes('elaborador') || isAdminPrincipal,
    // Director puede revisar: del sistema principal
    canReview: user?.perfil?.rol === 'director',
  };

  // Control del header por scroll
  useEffect(() => {
    if (isHome) return undefined;
    lastScrollY.current = window.scrollY || window.pageYOffset || 0;
    const THRESHOLD = 20;
    const MIN_DISTANCE = 50;
    const DEBOUNCE_MS = 60;

    const onScroll = () => {
      if (forceShowHeader) return;
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        const y = window.scrollY || window.pageYOffset || 0;
        const delta = y - lastScrollY.current;
        if (Math.abs(delta) < THRESHOLD) return;
        if (delta > 0 && y > MIN_DISTANCE) {
          setShowHeader(false);
        } else if (delta < 0) {
          setShowHeader(true);
        }
        lastScrollY.current = y;
      }, DEBOUNCE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    setShowHeader(true);
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout.current) { clearTimeout(scrollTimeout.current); scrollTimeout.current = null; }
    };
  }, [isHome, forceShowHeader]);

  // Escuchar eventos para mostrar/ocultar el header global
  useEffect(() => {
    const onShowHeader = () => {
      setShowHeader(true);
      setForceShowHeader(true);
    };
    const onHideHeader = () => {
      setShowHeader(false);
      setForceShowHeader(false);
      setHeaderSelectedActividad(null);
    };
    window.addEventListener('show-global-header', onShowHeader);
    window.addEventListener('hide-global-header', onHideHeader);
    return () => {
      window.removeEventListener('show-global-header', onShowHeader);
      window.removeEventListener('hide-global-header', onHideHeader);
    };
  }, []);

  // Escuchar eventos para mostrar acciones en el header (actividades)
  useEffect(() => {
    const onHeaderActions = (e) => {
      const sel = e?.detail?.selectedActividad ?? null;
      setHeaderSelectedActividad(sel);
    };
    window.addEventListener('header-actions', onHeaderActions);
    return () => window.removeEventListener('header-actions', onHeaderActions);
  }, []);

  // Escuchar selecciÃ³n de direcciÃ³n desde la página de indicadores
  useEffect(() => {
    const h = (e) => {
      const dir = e?.detail ?? null;
      setHeaderSelectedDireccion(dir);
    };
    window.addEventListener('direccion-selected', h);
    return () => window.removeEventListener('direccion-selected', h);
  }, []);

  // Escuchar selecciÃ³n de operaciÃ³n desde la página de indicadores
  useEffect(() => {
    const h = (e) => {
      const op = e?.detail ?? null;
      setHeaderSelectedOperacion(op);
    };
    window.addEventListener('operacion-selected', h);
    return () => window.removeEventListener('operacion-selected', h);
  }, []);

  // Escuchar peticiÃ³n para abrir modal en modo ediciÃ³n
  useEffect(() => {
    const h = (e) => {
      const op = e?.detail ?? null;
      if (op) {
        setEditOperacion(op);
        setShowNuevoIndicadorModal(true);
      }
    };
    window.addEventListener('open-edit-operacion', h);
    return () => window.removeEventListener('open-edit-operacion', h);
  }, []);

  // Escuchar peticion global para crear nuevo indicador desde el header.
  useEffect(() => {
    const h = (e) => {
      const page = e?.detail?.page ?? null;
      if (page !== 'indicadores') return;
      if (!headerSelectedDireccion) {
        window.alert('Primero selecciona una direccion para crear un indicador.');
        return;
      }
      setEditOperacion(null);
      setShowNuevoIndicadorModal(true);
    };
    window.addEventListener('open-new', h);
    return () => window.removeEventListener('open-new', h);
  }, [headerSelectedDireccion]);

  return (
    <div className={`poa-app flex min-h-screen transition-colors duration-500`}>
      {/* Toast notifications */}
      <Toaster position="top-right" />

      {/* Selector de Tema - Flotante Global */}
      <ThemeToggle theme={theme} setTheme={setTheme} />

      {/* Sidebar */}
      <Sidebar
        theme={theme}
        onNavigate={navigate}
        showGestionModal={showGestionModal}
        setShowGestionModal={setShowGestionModal}
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        user={user}
        poaPermissions={poaPermissions}
        poaRoles={poaRoles}
        pendingReviews={pendingReviews}
      />

      {/* Modal de gestiÃ³n */}
      {showGestionModal && (
        <GestionSelectorModal
          onClose={() => setShowGestionModal(false)}
          onSuccess={({ gestion, documentos }) => {
            setShowGestionModal(false);
            navigate('/poa/documentos', { state: { gestion, documentos } });
          }}
        />
      )}

      {/* Modal de indicador */}
      {showNuevoIndicadorModal && headerSelectedDireccion && (
        <NuevoIndicadorModal 
          direccion={headerSelectedDireccion} 
          operacion={editOperacion} 
          onClose={() => { 
            setShowNuevoIndicadorModal(false); 
            setEditOperacion(null); 
          }} 
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-72' : 'md:ml-16'}`}>
        {/* Header */}
        <Header 
          theme={theme}
          isHome={isHome}
          showHeader={showHeader}
          headerSelectedActividad={headerSelectedActividad}
          headerSelectedDireccion={headerSelectedDireccion}
          headerSelectedOperacion={headerSelectedOperacion}
          onNavigate={navigate}
          sidebarExpanded={sidebarExpanded}
          poaPermissions={poaPermissions}
        />

        {/* Contenido central */}
        <section className={`poa-main-surface flex flex-col items-stretch justify-start flex-1 ${isHome ? 'pt-2 md:pt-2 pb-6' : 'pt-28 md:pt-24 pb-6'} ${(isActividadesPage || isPresupuestosPage || isObjetivosPage) ? 'px-2 md:px-4' : 'px-4 md:px-20'} w-full`}>
          <Outlet context={{ user, poaRoles, poaPermissions }} />
        </section>
      </main>
    </div>
  );
}

export default POAApp;


