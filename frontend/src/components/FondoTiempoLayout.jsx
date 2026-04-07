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
    onProfileUpdate, // <-- Recibimos la prop
    onCarreraActivaChange,
}) => {
    return (
        <div className="flex h-screen overflow-hidden bg-blue-50 dark:bg-slate-900">
            {/* Selector de Tema - Flotante Global */}
            <ThemeToggle theme={theme} setTheme={setTheme} />

            {/* Sidebar */}
            <Sidebar 
                user={user} 
                onLogout={onLogout}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                onProfileUpdate={onProfileUpdate} // <-- La pasamos a Sidebar
                onCarreraActivaChange={onCarreraActivaChange}
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
