import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

const FondoTiempoLayout = ({ 
    user, 
    onLogout, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    theme,
    setTheme,
    onProfileUpdate // <-- Recibimos la prop
}) => {
    return (
        <div className="flex h-screen overflow-hidden bg-blue-50 dark:bg-slate-900">
            {/* Botón de Menú Hamburguesa */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`fixed top-3 z-50 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-all duration-300 ${
                sidebarCollapsed ? 'left-4' : 'left-60'
              }`}
              title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Selector de Tema - Flotante Global */}
            <ThemeToggle theme={theme} setTheme={setTheme} />

            {/* Sidebar */}
            <Sidebar 
                user={user} 
                onLogout={onLogout}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                onProfileUpdate={onProfileUpdate} // <-- La pasamos a Sidebar
            />

            {/* Contenido Principal del Módulo */}
            <main 
                className={`flex-1 h-screen overflow-y-auto transition-all duration-300 ${
                sidebarCollapsed ? 'ml-20' : 'ml-72'
                }`}
            >
                <div className="min-h-full bg-blue-50 dark:bg-slate-900">
                    {/* Las rutas anidadas (ListaFondos, DetalleFondo, etc.) se renderizarán aquí */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default FondoTiempoLayout;
