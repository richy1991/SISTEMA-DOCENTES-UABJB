import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import api from '../api';
import toast from 'react-hot-toast';

// --- ICONOS ---
// Se mantienen los mismos iconos, pero ahora se pueden personalizar más fácilmente.

// Icono para el botón de logout
const LogoutIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

// Icono para Fondo de Tiempo
const FondoTiempoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// Icono para POA
const POAIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

// Icono para Largo Plazo
const LargoPlazoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 12.75h.008v.008H12v-.008z" />
    </svg>
);

// Icono para Seguimiento
const SeguimientoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-1.5l-2.625 2.625a.75.75 0 001.06 1.06L10.5 18.75m0 0h-1.5a2.25 2.25 0 01-2.25-2.25v-1.5a2.25 2.25 0 012.25-2.25H10.5m0 0V6.375c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-1.5Z" />
    </svg>
);

// --- COMPONENTE PRINCIPAL ---
const ModuleSelector = ({ user, onLogout, theme, setTheme }) => {
    const navigate = useNavigate();

    // Lógica para obtener el nombre a mostrar (corregida)
    const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    const displayName = fullName || user?.username || 'Usuario';

    const handleLogoutClick = () => {
        onLogout();
        navigate('/login');
    };

    // Definición de módulos
    let modules = [];

    modules = [...modules,
        {
            name: 'Fondo de Tiempo',
            description: 'Gestión de carga horaria y proyectos.',
            path: '/fondo-tiempo',
            icon: FondoTiempoIcon,
            color: 'blue',
            enabled: true,
        },
        {
            name: 'Fondo a Largo Plazo',
            description: 'Proyectos de investigación y extensión.',
            path: '/largo-plazo',
            icon: LargoPlazoIcon,
            color: 'teal',
            enabled: true,
        },
        {
            name: 'Seguimiento Global',
            description: 'Actividad reciente de todos los fondos.',
            path: '/seguimiento',
            icon: SeguimientoIcon,
            color: 'indigo',
            enabled: true,
        },
        {
            name: 'POA',
            description: 'Plan Operativo Anual.',
            path: '/poa',
            icon: POAIcon,
            color: 'green',
            enabled: true,
        },
    ];

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-500 overflow-hidden">
            {/* Círculos decorativos animados (del login) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20 dark:opacity-30 animate-pulse bg-uab-blue-400 dark:bg-blue-500"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20 dark:opacity-30 animate-pulse bg-purple-400 dark:bg-purple-500" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Selector de Tema - Flotante */}
            <ThemeToggle theme={theme} setTheme={setTheme} />
            
            {/* Contenido Principal */}
            <div className="relative min-h-screen flex flex-col items-center justify-center p-4 z-10">
                
                {/* Header */}
                <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
                    {/* Lado Izquierdo: Mensaje de Bienvenida */}
                    <div className="text-sm font-medium backdrop-blur-sm bg-black/5 dark:bg-white/5 py-2 px-4 rounded-full">
                        Bienvenido, <span className="font-bold text-uab-blue-800 dark:text-uab-blue-300">{displayName}</span>
                    </div>

                    {/* Lado Derecho: Botones de Acción */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLogoutClick}
                            className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 backdrop-blur-sm bg-black/5 dark:bg-white/5 py-2 px-4 rounded-full"
                            title="Cerrar Sesión"
                        >
                            <LogoutIcon />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </header>
                
                {/* Título */}
                <div className="text-center mb-12 animate-fade-in">
                    <h1 className="text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-uab-blue-700 to-blue-800 dark:from-uab-blue-300 dark:to-blue-400">
                        Panel de Módulos
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400">Seleccione el sistema al que desea ingresar.</p>
                </div>

                {/* Grid de Módulos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl animate-fade-in" style={{animationDelay: '200ms'}}>
                    {modules.filter(m => m.enabled).map((module) => (
                        <ModuleCard key={module.name} {...module} onClick={module.action} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- TARJETA DE MÓDULO REDISEÑADA ---
const ModuleCard = ({ name, description, path, icon: Icon, color, enabled, onClick }) => {
    
    const colorClasses = {
        blue: {
            shadow: 'shadow-blue-500/30 dark:shadow-blue-500/20',
            hoverGlow: 'hover:ring-blue-500/50',
            icon: 'text-blue-600 dark:text-blue-400'
        },
        green: {
            shadow: 'shadow-green-500/30 dark:shadow-green-500/20',
            hoverGlow: 'hover:ring-green-500/50',
            icon: 'text-green-600 dark:text-green-400'
        },
        teal: {
            shadow: 'shadow-teal-500/30 dark:shadow-teal-500/20',
            hoverGlow: 'hover:ring-teal-500/50',
            icon: 'text-teal-600 dark:text-teal-400'
        },
        indigo: {
            shadow: 'shadow-indigo-500/30 dark:shadow-indigo-500/20',
            hoverGlow: 'hover:ring-indigo-500/50',
            icon: 'text-indigo-600 dark:text-indigo-400'
        },
        red: {
            shadow: 'shadow-red-500/30 dark:shadow-red-500/20',
            hoverGlow: 'hover:ring-red-500/50',
            icon: 'text-red-600 dark:text-red-400'
        },
        purple: {
            shadow: 'shadow-purple-500/30 dark:shadow-purple-500/20',
            hoverGlow: 'hover:ring-purple-500/50',
            icon: 'text-purple-600 dark:text-purple-400'
        },
        cyan: {
            shadow: 'shadow-cyan-500/30 dark:shadow-cyan-500/20',
            hoverGlow: 'hover:ring-cyan-500/50',
            icon: 'text-cyan-600 dark:text-cyan-400'
        },
        rose: {
            shadow: 'shadow-rose-500/30 dark:shadow-rose-500/20',
            hoverGlow: 'hover:ring-rose-500/50',
            icon: 'text-rose-600 dark:text-rose-400'
        },
        slate: {
            shadow: 'shadow-slate-500/30 dark:shadow-slate-500/20',
            hoverGlow: 'hover:ring-slate-500/50',
            icon: 'text-slate-600 dark:text-slate-400'
        }
    }

    const currentColors = colorClasses[color] || colorClasses.blue;

    const cardContent = (
        <div className={`
            relative p-8 rounded-2xl w-full h-full max-w-sm text-center flex flex-col items-center justify-center
            backdrop-blur-xl border border-white/20 dark:border-white/10
            bg-white/50 dark:bg-white/5
            shadow-xl ${currentColors.shadow}
            transition-all duration-300 group
            ${enabled 
                ? 'hover:shadow-2xl hover:-translate-y-2' 
                : 'opacity-60 cursor-not-allowed'
            }
        `}>
            {/* Anillo brillante en hover */}
            {enabled && <div className={`absolute inset-0 rounded-2xl ring-4 ring-transparent ${currentColors.hoverGlow} transition-all duration-300`}></div>}
            
            <div className="mb-4 transition-transform duration-300 group-hover:scale-110">
                <Icon className={`h-14 w-14 ${currentColors.icon}`} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{name}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            
            {!enabled && (
                <div className="absolute top-3 right-3 bg-uab-gold-500/80 dark:bg-uab-gold-500/50 text-white text-xs font-bold py-1 px-3 rounded-full backdrop-blur-sm">
                    PRÓXIMAMENTE
                </div>
            )}
        </div>
    );

    if (!enabled) {
        return cardContent;
    }

    if (onClick) {
        return (
            <button onClick={onClick} className="w-full focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-red-500/50 rounded-2xl transition-all duration-300 text-left">
                {cardContent}
            </button>
        );
    }

    return (
        <Link to={path} className="focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-blue-500/50 rounded-2xl transition-all duration-300">
            {cardContent}
        </Link>
    );
};

export default ModuleSelector;