import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../apis/api';
import ModalUsuario from './ModalUsuario';
import toast from 'react-hot-toast';

const InfoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const PauseIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
    </svg>
);

const PlayIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
);

const TrashIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const InputField = ({ label, name, type = 'text', value, onChange, required, disabled, error }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      placeholder={required ? '' : ' '}
      className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const ToggleSwitch = ({ isActive, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

function GestionUsuarios({ isDark, sidebarCollapsed = false }) {
  const navigate = useNavigate();
  const restoringFormRef = useRef(false);
  const [usuarios, setUsuarios] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing modal
  const [showModal, setShowModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({});
  const [crearNuevoDocente, setCrearNuevoDocente] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [abrirModalAlVolver, setAbrirModalAlVolver] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showToggleModal, setShowToggleModal] = useState(false);
  const [usuarioToToggle, setUsuarioToToggle] = useState(null);
  const [showOnlyOrphans, setShowOnlyOrphans] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  // 🔗 Recuperar datos del formulario al volver desde docentes
  useEffect(() => {
    const datosGuardados = sessionStorage.getItem('datosCrearUsuario');
    if (datosGuardados) {
      try {
        const datos = JSON.parse(datosGuardados);
        restoringFormRef.current = true;
        setFormData(datos);
        sessionStorage.removeItem('datosCrearUsuario');
        // Abrir el modal automáticamente con los datos recuperados
        setIsCreating(true);
        setAbrirModalAlVolver(false);
      } catch (e) {
        console.error('Error al recuperar datos:', e);
      }
    }
  }, []);

  const cargarDatos = async () => {
    try {
      const [usuariosRes, docentesRes, carrerasRes, rolesRes] = await Promise.all([
        api.get('/usuarios/'),
        api.get('/docentes/'),
        api.get('/carreras/'),
        api.get('/usuarios/roles/')
      ]);

      setUsuarios(usuariosRes.data.results || usuariosRes.data);
      setDocentes(docentesRes.data.results || docentesRes.data);
      setCarreras(carrerasRes.data.results || carrerasRes.data);
      setRoles(rolesRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos');
      setLoading(false);
    }
  };
  const usuariosFiltrados = showOnlyOrphans
    ? usuarios.filter((usuario) => usuario.perfil?.rol === 'docente' && !usuario.perfil?.docente)
    : usuarios;

  // Initialize form when creation starts
  useEffect(() => {
    if (isCreating) {
      if (restoringFormRef.current) {
        restoringFormRef.current = false;
        setCrearNuevoDocente(false);
        setErrors({});
        return;
      }
      const initialData = {
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        rol: 'docente',
        carrera: '',
        docente: '',
        password: '',
        password_confirm: '',
      };
      setFormData(initialData);
      setCrearNuevoDocente(false);
      setErrors({});
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
    setUsuarioEditando(null); // Ensure we are not in edit mode
  };

  const abrirModalEditar = (usuario) => {
    setUsuarioEditando(usuario);
    setShowModal(true);
    setIsCreating(false); // Hide create form if it was open
  };

  const handleToggleActivo = (usuario) => {
    setUsuarioToToggle(usuario);
    setShowToggleModal(true);
  };

  const handleEliminar = (usuario) => {
    setUsuarioToDelete(usuario);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUsuarioToDelete(null);
    setDeleteConfirmText('');
  };

  const confirmarEliminar = async () => {
    if (!usuarioToDelete) return;
    if (deleteConfirmText !== usuarioToDelete.username) {
      toast.error('Debes escribir exactamente el nombre de usuario para confirmar');
      return;
    }
    try {
      await api.delete(`/usuarios/${usuarioToDelete.id}/`);
      toast.success('Usuario eliminado con éxito');
      cargarDatos();
      closeDeleteModal();
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error al eliminar el usuario');
    }
  };
  // --- FORM LOGIC FOR INLINE CREATION ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-generar contraseña por defecto al escribir el username
      if (name === 'username') {
        updated.password = value + 'UABJB';
        updated.password_confirm = value + 'UABJB';
      }

      return updated;
    });
  };

  const handleRolChange = (e) => {
    const newRol = e.target.value;
    setFormData(prev => ({
      ...prev,
      rol: newRol,
      carrera: (newRol === 'director' || newRol === 'jefe_estudios') ? prev.carrera : '',
      docente: newRol !== 'docente' ? '' : prev.docente,
    }));
    if (newRol !== 'docente') {
      setCrearNuevoDocente(false);
    }
  };

  const handleCrearNuevoDocente = () => {
    // 🔗 Al marcar checkbox, ir a /fondo-tiempo/docentes y abrir modal
    // Guardar datos del formulario en sessionStorage para recuperarlos al volver
    sessionStorage.setItem('datosCrearUsuario', JSON.stringify(formData));
    const apellidos = (formData.last_name || '').trim().split(/\s+/).filter(Boolean);
    sessionStorage.setItem('datosCrearDocente', JSON.stringify({
      nombres: formData.first_name || '',
      apellido_paterno: apellidos[0] || '',
      apellido_materno: apellidos.slice(1).join(' '),
      email: formData.email || '',
      telefono: '',
    }));
    sessionStorage.setItem('abrirModalDesdeUsuarios', 'true');
    // Marcar para abrir modal al volver
    setAbrirModalAlVolver(true);
    navigate('/fondo-tiempo/docentes');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    let payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      rol: formData.rol,
      password: formData.password,
      password_confirm: formData.password_confirm,
    };

    if (formData.rol === 'director' || formData.rol === 'jefe_estudios') {
      payload.carrera = formData.carrera;
    } else if (formData.rol === 'docente') {
      payload.docente = formData.docente;
    }

    try {
      await api.post('/usuarios/', payload);
      toast.success('Usuario creado correctamente');
      setIsCreating(false);
      cargarDatos();
    } catch (err) {
      console.error('Error al crear usuario:', err.response);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        setErrors(apiErrors);
        const errorMsg = Object.values(apiErrors).flat().join(' ');
        toast.error(`Error: ${errorMsg}`);
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                👥 Gestión de Usuarios
              </h1>
              <p className="text-slate-700 dark:text-slate-300 mt-1">
                Administración de cuentas y permisos
              </p>
            </div>
            <button
              onClick={handleToggleCreateForm}
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
            >
              <span>{isCreating ? '➖' : '➕'}</span>
              {isCreating ? 'Cancelar Creación' : 'Crear Usuario'}
            </button>
          </div>
        </div>

        {/* MODAL DE CREACIÓN DE USUARIO */}
        {isCreating && createPortal((
          <div
            className={`fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${crearNuevoDocente && formData.rol === 'docente' ? '!justify-center' : ''}`}
            style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
          >
            <div className={`flex items-center justify-center w-full h-full ${crearNuevoDocente && formData.rol === 'docente' ? 'gap-6' : ''}`}>
              {/* Modal Usuario - mantiene su tamaño original */}
              <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in transition-all duration-300 ${crearNuevoDocente && formData.rol === 'docente' ? 'max-w-2xl w-full' : 'max-w-2xl w-full mx-4'}`}>
                {/* Header azul */}
                <div className="bg-[#2C4AAE] dark:bg-[#1a3a8a] px-6 py-4">
                  <h2 className="text-xl font-bold text-white">
                    Crear Nuevo Usuario
                  </h2>
                </div>

              <form onSubmit={handleSubmit}>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fila 1 */}
                    <InputField label="Usuario *" name="username" value={formData.username || ''} onChange={handleChange} error={errors.username} />
                    <InputField label="Email" name="email" type="email" value={formData.email || ''} onChange={handleChange} error={errors.email} />

                    {/* Fila 2 */}
                    <InputField label="Nombres *" name="first_name" value={formData.first_name || ''} onChange={handleChange} error={errors.first_name} />
                    <InputField label="Apellidos *" name="last_name" value={formData.last_name || ''} onChange={handleChange} error={errors.last_name} />

                    {/* Rol */}
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Rol</label>
                      <select
                        name="rol"
                        value={formData.rol || 'docente'}
                        onChange={handleRolChange}
                        className="w-full px-4 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {roles.map(rol => (
                          <option key={rol.value} value={rol.value}>{rol.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Vincular a Docente Existente - solo para rol docente */}
                    {formData.rol === 'docente' && !crearNuevoDocente && (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">
                          Vincular a Docente Existente
                        </label>
                        <select
                          name="docente"
                          value={formData.docente}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Seleccione un docente</option>
                          {docentes.map(d => (
                            <option key={d.id} value={d.id}>{d.nombre_completo}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Carrera para director/jefe_estudios */}
                    {(formData.rol === 'director' || formData.rol === 'jefe_estudios') && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Carrera</label>
                        <select
                          name="carrera"
                          value={formData.carrera}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Seleccione una carrera</option>
                          {carreras.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Opción para docente */}
                    {formData.rol === 'docente' && (
                      <div className="md:col-span-2 space-y-3">
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={crearNuevoDocente}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // 🔗 Ir a página de docentes y abrir modal
                                handleCrearNuevoDocente();
                              } else {
                                setCrearNuevoDocente(false);
                              }
                            }}
                            className="w-5 h-5 text-blue-600 rounded"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Crear nuevo registro de docente
                          </span>
                        </label>

                        {/* Contraseña - movido abajo del checkbox */}
                        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5">
                          <span className="text-sm text-amber-800 dark:text-amber-300">
                            Contraseña inicial: <strong className="font-mono">{formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer con botones */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700 border-t border-slate-200 dark:border-slate-600 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-6 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        ), document.body)}
 
        {/* Modal for editing */}
        <ModalUsuario
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSaveSuccess={() => {
            setShowModal(false);
            cargarDatos();
          }}
          userToEdit={usuarioEditando}
          docentes={docentes}
          carreras={carreras}
          roles={roles}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowOnlyOrphans((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              showOnlyOrphans
                ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
            }`}
          >
            {showOnlyOrphans ? 'Ver todos' : 'Ver huérfanos'}
          </button>
        </div>
        
        {/* Tabla de usuarios */}
        <div id="fondo-usuarios-tabla" className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-slate-300 dark:divide-slate-700">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Nombre Completo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {usuariosFiltrados.map(usuario => (
                  <tr key={usuario.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 dark:text-white">{usuario.username}</div>
                        {usuario.perfil?.rol === 'docente' && !usuario.perfil?.docente && (
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            ❌ Sin Vínculo Docente
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        {usuario.nombre_completo || `${usuario.first_name} ${usuario.last_name}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1.5 inline-flex text-xs font-bold rounded-lg border-2 shadow-sm ${
                        usuario.perfil?.rol === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' :
                        usuario.perfil?.rol === 'director' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' :
                        usuario.perfil?.rol === 'jefe_estudios' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700' :
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                      }`}>
                        {usuario.perfil?.rol === 'admin' ? '🛡️ Admin' :
                         usuario.perfil?.rol === 'director' ? '👔 Director' :
                         usuario.perfil?.rol === 'jefe_estudios' ? '🧑‍⚖️ Jefe de Estudios' : '👨‍🏫 Docente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {usuario.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <ToggleSwitch 
                          isActive={usuario.is_active}
                          onChange={() => handleToggleActivo(usuario)}
                        />
                        <span className="text-sm font-semibold">
                          {usuario.is_active 
                            ? <span className="text-emerald-600 dark:text-emerald-400">Activo</span>
                            : <span className="text-amber-600 dark:text-amber-400">Inactivo</span>
                          }
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => abrirModalEditar(usuario)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
                        >
                          <PencilIcon className="w-4 h-4" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleEliminar(usuario)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 text-white text-xs font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {usuarios.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">No hay usuarios registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Confirmación de Toggle Estado */}
        {showToggleModal && usuarioToToggle && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowToggleModal(false)} />
            <div
              className={`relative w-full max-w-lg rounded-2xl border bg-slate-900 shadow-2xl overflow-hidden animate-slide-up ${
                usuarioToToggle.is_active
                  ? 'border-uab-gold-300/40 dark:border-uab-gold-700/50'
                  : 'border-uab-green-300/40 dark:border-uab-green-700/50'
              }`}
              style={{ animationDuration: '160ms' }}
            >
              <div className={`px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r ${usuarioToToggle.is_active ? 'from-uab-gold-900/30 to-slate-900' : 'from-uab-green-900/30 to-slate-900'}`}>
                <h4 className={`text-lg font-bold flex items-center gap-2 ${usuarioToToggle.is_active ? 'text-uab-gold-300' : 'text-uab-green-300'}`}>
                  <span>{usuarioToToggle.is_active ? '⏸️' : '▶️'}</span>
                  {usuarioToToggle.is_active ? 'Confirmar Pausa de Acceso' : 'Confirmar Reactivación'}
                </h4>
              </div>
              <div className="px-5 py-4 space-y-3 text-slate-200">
                <p className="text-sm leading-relaxed">
                  {usuarioToToggle.is_active
                    ? `Se pausará el acceso de ${usuarioToToggle.username} al sistema.`
                    : `Se reactivará el acceso de ${usuarioToToggle.username} al sistema.`}
                </p>
                <div className={`rounded-lg border px-3 py-2 text-sm ${usuarioToToggle.is_active ? 'border-uab-gold-500/40 bg-uab-gold-500/10' : 'border-uab-green-500/40 bg-uab-green-500/10'}`}>
                  Usuario: <strong className={usuarioToToggle.is_active ? 'text-uab-gold-300' : 'text-uab-green-300'}>{usuarioToToggle.username}</strong>
                </div>
                <p className="text-xs text-slate-400">
                  Esta acción se puede revertir desde el interruptor de estado.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-700/70 flex justify-end gap-3 bg-slate-950/70">
                <button
                  type="button"
                  onClick={() => setShowToggleModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-300 border border-slate-600 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.post(`/usuarios/${usuarioToToggle.id}/toggle_activo/`);
                      toast.success(`Usuario ${usuarioToToggle.is_active ? 'pausado' : 'reactivado'} con exito`);
                      setShowToggleModal(false);
                      cargarDatos();
                    } catch (err) {
                      console.error('Error:', err);
                      toast.error('Error al cambiar el estado del usuario');
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-white ${usuarioToToggle.is_active ? 'bg-uab-gold-600 hover:bg-uab-gold-700' : 'bg-uab-green-600 hover:bg-uab-green-700'}`}
                >
                  {usuarioToToggle.is_active ? '⏸️ Confirmar Pausa' : '▶️ Confirmar Reactivación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Eliminación */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
            <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
              <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
                <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                  <span>🗑️</span>
                  Confirmar Eliminación
                </h4>
              </div>
              <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
                <p className="text-sm leading-relaxed">
                  Se eliminará el usuario <strong className="text-slate-900 dark:text-white">{usuarioToDelete?.username}</strong> del sistema de forma permanente.
                </p>
                <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                  Acción irreversible: <strong className="text-red-900 dark:text-red-300">El usuario perderá su acceso definitivamente.</strong>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Escribe el nombre exacto de usuario para habilitar la eliminación:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Escribe el nombre de usuario para confirmar"
                    className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta operación no se puede deshacer.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminar}
                  disabled={deleteConfirmText !== (usuarioToDelete?.username || '')}
                  className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GestionUsuarios;
