import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';

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
    useEffect(() => {
        document.documentElement.style.setProperty('--fondo-sidebar-width', sidebarCollapsed ? '5rem' : '18rem');
        return () => {
            document.documentElement.style.removeProperty('--fondo-sidebar-width');
        };
    }, [sidebarCollapsed]);

    return (
        <div
            className="flex h-screen overflow-hidden bg-[#d8e6f0] dark:bg-slate-900"
            style={{
                '--fondo-sidebar-width': sidebarCollapsed ? '5rem' : '18rem',
                fontFamily: '"Nunito Sans", "Segoe UI", Helvetica, Arial, sans-serif',
            }}
        >
            {/* El ThemeToggle ahora está integrado en el Sidebar */}

            {/* Sidebar */}
            <Sidebar 
                user={user} 
                onLogout={onLogout}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                theme={theme}
                setTheme={setTheme}
                onProfileUpdate={onProfileUpdate}
                onCarreraActivaChange={onCarreraActivaChange}
            />

            {/* Contenido Principal del Módulo */}
            <main 
                className={`flex-1 h-screen overflow-y-auto transition-all duration-300 ${
                sidebarCollapsed ? 'ml-20' : 'ml-72'
                }`}
            >
                <div className="min-h-full bg-[#d8e6f0] dark:bg-slate-900">
                    {/* Las rutas anidadas (ListaFondos, DetalleFondo, etc.) se renderizarán aquí */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default FondoTiempoLayout;
