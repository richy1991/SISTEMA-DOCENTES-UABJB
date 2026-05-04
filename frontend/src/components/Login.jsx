import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const response = await axios.post('http://127.0.0.1:8000/api/token/', {
      username,
      password,
    });

    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);

    const userResponse = await axios.get('http://127.0.0.1:8000/api/usuario/', {
      headers: {
        Authorization: `Bearer ${response.data.access}`,
      },
    });

    localStorage.setItem('user', JSON.stringify(userResponse.data));
    onLogin(userResponse.data);

    const redirectTo = sessionStorage.getItem('post_login_redirect');
    if (redirectTo) {
      sessionStorage.removeItem('post_login_redirect');
    }
    
    if (userResponse.data.perfil?.debe_cambiar_password) {
      navigate('/cambiar-password');
    } else {
      navigate(redirectTo || '/');
    }

  } catch (err) {
    console.error(err);
    if (err.response?.status === 401) {
      toast.error('Usuario o contraseña incorrectos');
    } else if (err.response?.status === 500) {
      toast.error('Error del servidor. Intenta más tarde.');
    } else if (!err.response) {
      toast.error('No se puede conectar con el servidor.');
    } else {
      toast.error('Error al iniciar sesión.');
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans text-slate-100">
      
      {/* Background with Gradient and Shapes */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1735] via-[#12224a] to-[#2a1f52]">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-blue-500/30 blur-[120px] animate-blob"></div>
            <div className="absolute top-[18%] right-[-8%] w-[45%] h-[45%] rounded-full bg-indigo-500/28 blur-[120px] animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-12%] left-[18%] w-[45%] h-[45%] rounded-full bg-violet-500/28 blur-[120px] animate-blob animation-delay-4000"></div>
        </div>
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-[0.3]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.24),transparent_40%)]"></div>

      {/* Login Card */}
      <div className="relative w-full max-w-md p-8 mx-4 bg-white/12 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_32px_95px_rgba(8,15,40,0.62),0_10px_30px_rgba(59,130,246,0.2)] card-stand-up" style={{ perspective: '1200px' }}>
        <div className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-blue-300/90 to-transparent" />
        <div className="absolute -bottom-8 inset-x-16 h-10 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center w-32 h-32 mb-6 rounded-[36px] overflow-hidden bubble-logo logo-intro transition-transform duration-300 hover:scale-105">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.65),transparent_42%),linear-gradient(145deg,#3b82f6_0%,#4338ca_48%,#7c3aed_100%)]" />
            <img src="/images/LOGOUAB.png" alt="Logo UAB" className="relative z-10 w-28 h-28 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.55)]" />
            <div className="absolute top-2 left-3 w-16 h-5 rounded-full bg-white/35 blur-sm" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Bienvenido</h1>
          <p className="text-blue-100/80 text-sm font-medium">Sistema de Planificacion y Gestion Institucional - UAB JB</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Username */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-100/85 ml-1 uppercase tracking-wider">Usuario</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-200/70 group-focus-within:text-blue-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="block w-full pl-11 pr-4 py-4 bg-blue-500/20 border border-blue-400/40 rounded-xl text-white placeholder-blue-100/70 focus:outline-none focus:ring-4 focus:ring-blue-300/40 focus:border-blue-300/80 transition-all duration-200 hover:border-blue-300/60 hover:bg-blue-500/25 shadow-[0_10px_24px_rgba(8,15,40,0.35),inset_0_2px_4px_rgba(59,130,246,0.2)]"
                placeholder="Ingrese su usuario"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-100/85 ml-1 uppercase tracking-wider">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-200/70 group-focus-within:text-blue-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full pl-11 pr-14 py-4 bg-blue-500/20 border border-blue-400/40 rounded-xl text-white placeholder-blue-100/70 focus:outline-none focus:ring-4 focus:ring-blue-300/40 focus:border-blue-300/80 transition-all duration-200 hover:border-blue-300/60 hover:bg-blue-500/25 shadow-[0_10px_24px_rgba(8,15,40,0.35),inset_0_2px_4px_rgba(59,130,246,0.2)]"
                placeholder="Ingrese su contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center justify-center text-blue-100 hover:text-blue-50 transition-colors duration-200 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 bg-transparent border-none p-0"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.4 8.6-7 10-3.6-1.4-7-5-7-10V7l7-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.4 8.6-7 10-3.6-1.4-7-5-7-10V7l7-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 11.5h5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.5v4" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[11px] text-blue-100/65 ml-1">Usa el icono para mostrar u ocultar la contraseña.</p>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-[0_16px_32px_rgba(79,70,229,0.45),0_8px_20px_rgba(8,15,40,0.35)] transform transition-all duration-200 hover:scale-[1.01] active:scale-[0.985] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Iniciando...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs text-blue-100/65">
            © {new Date().getFullYear()} Universidad Autónoma del Beni "José Ballivián"
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        @keyframes cardStandUp {
          0% {
            opacity: 0;
            transform: rotateX(85deg) translateZ(0) scale(0.9);
            filter: blur(4px);
          }
          60% {
            opacity: 1;
            transform: rotateX(-8deg) translateZ(0) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg) translateZ(0) scale(1);
            filter: blur(0);
          }
        }
        .card-stand-up {
          animation: cardStandUp 2200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transform-origin: center bottom;
          will-change: transform, opacity, filter;
        }
        .bubble-logo {
          box-shadow: 0 24px 42px rgba(37, 99, 235, 0.5), 0 10px 22px rgba(8, 15, 40, 0.42), inset 0 1px 2px rgba(255, 255, 255, 0.45);
        }
        .logo-intro {
          animation: logoCardIntro 1800ms cubic-bezier(0.2, 0.9, 0.2, 1) both, bubbleFloat 5s ease-in-out 2000ms infinite;
          transform-origin: center center;
          will-change: transform, opacity, filter;
        }
        @keyframes logoCardIntro {
          0% {
            transform: scale(3.4);
            opacity: 0.2;
            filter: blur(3px);
          }
          70% {
            transform: scale(0.93);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

export default Login;