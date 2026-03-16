import { Outlet, Link } from 'react-router-dom';

const SimpleLayout = () => {
    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-slate-900">
            <Link
                to="/"
                className="absolute top-6 left-6 z-10 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full shadow-md hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                <span>Volver al Panel</span>
            </Link>
            {/* El contenido (Proximamente.jsx) se renderizará aquí */}
            <Outlet />
        </div>
    );
};

export default SimpleLayout;