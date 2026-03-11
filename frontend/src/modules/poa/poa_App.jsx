import { Routes, Route, Outlet } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ThemeToggle from '../../components/ThemeToggle';
import GestionSelectorModal from './components/GestionSelectorModal';
import NuevoIndicadorModal from './components/NuevoIndicadorModal';
import POAHomePage from './pages/POAHomePage';
import DireccionesPage from './pages/DireccionesPage';
import PersonasPage from './pages/PersonasPage';
import DocumentosPOAPage from './pages/DocumentosPOAPage';
import ActividadesPage from './pages/ActividadesPage';
import ObjetivosEspecificosPage from './pages/ObjetivosEspecificosPage';
import PresupuestosPage from './pages/PresupuestosPage';
import CatalogoItems from './pages/CatalogoItems';
import CatalogosMenu from './pages/CatalogosMenu';
import Reportes from './pages/Reportes';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem('theme') || 'dark';
};

function POAApp({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(getInitialTheme);
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [showNuevoIndicadorModal, setShowNuevoIndicadorModal] = useState(false);
  const [editOperacion, setEditOperacion] = useState(null);
  const [headerSelectedActividad, setHeaderSelectedActividad] = useState(null);
  const [headerSelectedDireccion, setHeaderSelectedDireccion] = useState(null);
  const [headerSelectedOperacion, setHeaderSelectedOperacion] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const [forceShowHeader, setForceShowHeader] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef(null);

  const isHome = location?.pathname === '/poa' || location?.pathname === '/poa/';

  // Debug: verificar usuario
  console.log('POAApp user:', user);

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

  // Actualizar tema
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('theme', theme);
    document.documentElement?.setAttribute('data-theme', theme);
    // También aplicar la clase dark para compatibilidad con ThemeToggle
    document.documentElement?.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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

  // Escuchar selección de dirección desde DireccionesPage
  useEffect(() => {
    const h = (e) => {
      const dir = e?.detail ?? null;
      setHeaderSelectedDireccion(dir);
    };
    window.addEventListener('direccion-selected', h);
    return () => window.removeEventListener('direccion-selected', h);
  }, []);

  // Escuchar selección de operación desde DireccionesPage
  useEffect(() => {
    const h = (e) => {
      const op = e?.detail ?? null;
      setHeaderSelectedOperacion(op);
    };
    window.addEventListener('operacion-selected', h);
    return () => window.removeEventListener('operacion-selected', h);
  }, []);

  // Escuchar petición para abrir modal en modo edición
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

  return (
    <div className={`flex min-h-screen transition-colors duration-500`}>
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
      />

      {/* Modal de gestión */}
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
      <main className={`flex-1 flex flex-col transition-all duration-300 ${sidebarExpanded ? 'ml-72' : 'ml-16'}`}>
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
        />

        {/* Contenido central */}
        <section className={`flex flex-col items-center justify-center flex-1 ${isHome ? 'py-12' : 'pt-24 pb-6'} px-4 w-full`}>
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default POAApp;
