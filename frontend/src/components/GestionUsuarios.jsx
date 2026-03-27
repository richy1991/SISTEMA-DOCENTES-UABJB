import { useState, useEffect } from 'react';
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
      className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
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

const dedicacionStyles = {
  tiempo_completo: {
      bg: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
      border: 'border-blue-500',
      icon: 'text-blue-500',
      title: 'text-blue-800 dark:text-blue-300',
      text: 'text-blue-700 dark:text-blue-400',
  },
  medio_tiempo: {
      bg: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
      border: 'border-green-500',
      icon: 'text-green-500',
      title: 'text-green-800 dark:text-green-300',
      text: 'text-green-700 dark:text-green-400',
  },
  horario: {
      bg: 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
      border: 'border-orange-500',
      icon: 'text-orange-500',
      title: 'text-orange-800 dark:text-orange-300',
      text: 'text-orange-700 dark:text-orange-400',
  },
};

function GestionUsuarios({ isDark }) {
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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showToggleModal, setShowToggleModal] = useState(false);
  const [usuarioToToggle, setUsuarioToToggle] = useState(null);

  useEffect(() => {
    cargarDatos();
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

  // Initialize form when creation starts
  useEffect(() => {
    if (isCreating) {
      const initialData = {
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        ci: '',
        rol: 'docente',
        carrera: '',
        docente: '',
        password: '',
        password_confirm: '',
        docente_data: {
          nombres: '',
          apellido_paterno: '',
          apellido_materno: '',
          categoria: 'catedratico',
          dedicacion: 'tiempo_completo',
        }
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

      // AUTOMATIZACIÓN: Si estamos creando un docente nuevo, copiamos los datos del usuario
      if (crearNuevoDocente) {
        if (name === 'first_name') {
          updated.docente_data = { ...updated.docente_data, nombres: value };
        }
        if (name === 'last_name') {
          const parts = value.trim().split(' ');
          const paterno = parts[0] || '';
          const materno = parts.slice(1).join(' ') || '';
          updated.docente_data = { 
            ...updated.docente_data, 
            apellido_paterno: paterno,
            apellido_materno: materno 
          };
        }
        if (name === 'ci') {
          updated.docente_data = { ...updated.docente_data, ci: value };
        }
      }
      if (name === 'docente' && value) {
        const docenteSeleccionado = docentes.find((docente) => String(docente.id) === String(value));
        if (docenteSeleccionado?.ci) {
          updated.ci = docenteSeleccionado.ci;
        }
      }
      return updated;
    });
  };

  const handleDocenteDataChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newDocenteData = {
            ...prev.docente_data,
            [name]: value,
        };
        if (name === 'dedicacion' && value !== 'horario') {
            newDocenteData.horas_contrato_semanales = null;
        }
        return { ...prev, docente_data: newDocenteData };
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const normalizeCi = (value) => String(value || '').trim().replace(/\s+/g, '').toUpperCase();
    const submittedCi = normalizeCi(formData.ci);

    if (!submittedCi) {
      setErrors({ ci: ['La cédula de identidad es obligatoria.'] });
      toast.error('Debe ingresar la cédula de identidad.');
      setIsSubmitting(false);
      return;
    }

    const docenteExistenteSeleccionado = docentes.find((docente) => String(docente.id) === String(formData.docente));
    const ciDuplicadoEnDocentes = docentes.some((docente) => {
      const mismoCi = normalizeCi(docente?.ci) === submittedCi;
      if (!mismoCi) return false;
      if (formData.rol === 'docente' && !crearNuevoDocente && docenteExistenteSeleccionado) {
        return String(docente.id) !== String(docenteExistenteSeleccionado.id);
      }
      return true;
    });
    const ciDuplicadoEnUsuarios = usuarios.some((usuario) => {
      const mismoCi = normalizeCi(usuario?.perfil?.ci) === submittedCi;
      if (!mismoCi) return false;
      if (formData.rol === 'docente' && !crearNuevoDocente && docenteExistenteSeleccionado) {
        return String(usuario?.perfil?.docente) !== String(docenteExistenteSeleccionado.id);
      }
      return true;
    });

    if (ciDuplicadoEnDocentes || ciDuplicadoEnUsuarios) {
      setErrors({ ci: ['Ya existe una persona registrada con esta cédula de identidad.'] });
      toast.error('La persona ya está registrada con ese CI.');
      setIsSubmitting(false);
      return;
    }

    let payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      ci: formData.ci,
      rol: formData.rol,
      password: formData.password,
      password_confirm: formData.password_confirm,
    };

    if (formData.rol === 'director' || formData.rol === 'jefe_estudios') {
      payload.carrera = formData.carrera;
    } else if (formData.rol === 'docente') {
      if (crearNuevoDocente) {
        payload.docente_data = {
          ...formData.docente_data,
          ci: formData.ci,
        };
      } else {
        payload.docente = formData.docente;
      }
    }

    try {
      await api.post('/usuarios/', payload);
      toast.success('Usuario creado correctamente');
      setIsCreating(false); // Hide form on success
      cargarDatos(); // Refresh list
    } catch (err) {
      console.error('Error al crear usuario:', err.response);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        const normalizedErrors = { ...apiErrors };
        if (apiErrors?.docente_data?.ci) {
          normalizedErrors.ci = Array.isArray(apiErrors.docente_data.ci)
            ? apiErrors.docente_data.ci
            : [apiErrors.docente_data.ci];
        }
        setErrors(normalizedErrors);
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

        {/* FORMULARIO DE CREACIÓN EN LÍNEA */}
        {isCreating && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg mt-6 animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Crear Nuevo Usuario
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Columna Izquierda */}
                  <div className="space-y-4">
                    <InputField label="Usuario" name="username" value={formData.username || ''} onChange={handleChange} required error={errors.username} />
                    <InputField label="Email" name="email" type="email" value={formData.email || ''} onChange={handleChange} error={errors.email} />
                    <InputField label="Cédula de Identidad (CI)" name="ci" value={formData.ci || ''} onChange={handleChange} required error={errors.ci} />
                    <InputField label="Nombres" name="first_name" value={formData.first_name || ''} onChange={handleChange} required error={errors.first_name} />
                    <InputField label="Apellidos" name="last_name" value={formData.last_name || ''} onChange={handleChange} required error={errors.last_name} />
                    <div className="pt-1">
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                        Contraseña inicial <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.username ? `${formData.username}UABJB` : ''}
                          readOnly
                          placeholder="Se generará al ingresar el usuario"
                          className="w-full px-4 py-3 rounded-xl border-2 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 cursor-not-allowed font-mono tracking-wide"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" title="Contraseña generada automáticamente">🔒</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mt-2">
                        <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>La contraseña por defecto será <strong>{formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}</strong>. El usuario deberá personalizarla al iniciar sesión por primera vez.</span>
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Rol</label>
                      <select name="rol" value={formData.rol || 'docente'} onChange={handleRolChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                        {roles.map(rol => (
                          <option key={rol.value} value={rol.value}>{rol.label}</option>
                        ))}
                      </select>
                    </div>

                    {(formData.rol === 'director' || formData.rol === 'jefe_estudios') && (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Carrera</label>
                        <select name="carrera" value={formData.carrera} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600" required>
                          <option value="">Seleccione una carrera</option>
                          {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        {errors.carrera && <p className="text-xs text-red-600 mt-1">{errors.carrera}</p>}
                      </div>
                    )}

                    {formData.rol === 'docente' && (
                      <div className="md:col-span-2 p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl space-y-4 bg-slate-50 dark:bg-slate-800/30">
                          <label className="flex items-center gap-3 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={crearNuevoDocente} 
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setCrearNuevoDocente(isChecked);
                                  // Al activar, copiar lo que ya se haya escrito arriba
                                  if (isChecked) {
                                    setFormData(prev => {
                                      const parts = (prev.last_name || '').trim().split(' ');
                                      const paterno = parts[0] || '';
                                      const materno = parts.slice(1).join(' ') || '';
                                      return {
                                        ...prev,
                                        docente_data: {
                                          ...prev.docente_data,
                                          ci: prev.ci || '',
                                          nombres: prev.first_name || '',
                                          apellido_paterno: paterno,
                                          apellido_materno: materno
                                        }
                                      };
                                    });
                                  }
                                }} 
                                className="w-5 h-5 text-blue-600 rounded border-slate-400 focus:ring-blue-500" 
                              />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">Crear nuevo registro de docente</span>
                          </label>

                          {crearNuevoDocente ? (
                              <div className="p-5 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600 space-y-4">
                                  <h4 className="font-bold text-lg text-blue-600 dark:text-blue-400 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                                    Datos del Nuevo Docente
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                      <div className="md:col-span-2">
                                        <InputField label="Nombres" name="nombres" value={formData.docente_data.nombres} onChange={handleDocenteDataChange} required error={errors.docente_data?.nombres} />
                                      </div>
                                      <InputField label="Apellido Paterno" name="apellido_paterno" value={formData.docente_data.apellido_paterno} onChange={handleDocenteDataChange} required error={errors.docente_data?.apellido_paterno} />
                                      <InputField label="Apellido Materno" name="apellido_materno" value={formData.docente_data.apellido_materno} onChange={handleDocenteDataChange} error={errors.docente_data?.apellido_materno} />
                                      <div>
                                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Categoría</label>
                                          <select name="categoria" value={formData.docente_data.categoria} onChange={handleDocenteDataChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                                              <option value="catedratico">Catedrático</option>
                                              <option value="adjunto">Adjunto</option>
                                              <option value="asistente">Asistente</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Dedicación</label>
                                          <select name="dedicacion" value={formData.docente_data.dedicacion} onChange={handleDocenteDataChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                                              <option value="tiempo_completo">Tiempo Completo</option>
                                              <option value="medio_tiempo">Medio Tiempo</option>
                                              <option value="horario">Horario</option>
                                          </select>
                                      </div>
                                      {formData.docente_data.dedicacion === 'horario' ? (
                                          <InputField
                                              label="Horas Semanales por Contrato"
                                              name="horas_contrato_semanales"
                                              type="number"
                                              value={formData.docente_data.horas_contrato_semanales || ''}
                                              onChange={handleDocenteDataChange}
                                              required
                                              error={errors.docente_data?.horas_contrato_semanales}
                                              placeholder="Ej: 8, 12, 16"
                                          />
                                      ) : (
                                          <div>
                                              <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Horas Semanales Requeridas</label>
                                              <input
                                                  type="number"
                                                  value={formData.docente_data.dedicacion === 'tiempo_completo' ? 40 : 20}
                                                  disabled
                                                  className="w-full px-4 py-3 rounded-xl border-2 bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                                              />
                                          </div>
                                      )}
                                  </div>
                                  <div className={`mt-4 p-4 rounded-xl ${dedicacionStyles[formData.docente_data.dedicacion]?.bg} border-l-4 ${dedicacionStyles[formData.docente_data.dedicacion]?.border} shadow-sm`}>
                                    <div className="flex items-start gap-3">
                                        <InfoIcon className={`w-6 h-6 ${dedicacionStyles[formData.docente_data.dedicacion]?.icon} flex-shrink-0 mt-0.5`} />
                                        <div>
                                            <h5 className={`font-semibold ${dedicacionStyles[formData.docente_data.dedicacion]?.title}`}>Información sobre Dedicación</h5>
                                            <p className={`text-sm ${dedicacionStyles[formData.docente_data.dedicacion]?.text} mt-1`}>
                                                {formData.docente_data.dedicacion === 'tiempo_completo' && 'La dedicación a Tiempo Completo implica un total de 40 horas semanales.'}
                                                {formData.docente_data.dedicacion === 'medio_tiempo' && 'La dedicación a Medio Tiempo implica un total de 20 horas semanales.'}
                                                {formData.docente_data.dedicacion === 'horario' && 'Para la dedicación por Horario, debe especificar el número de horas semanales según el contrato.'}
                                            </p>
                                        </div>
                                    </div>
                                  </div>
                              </div>
                          ) : (
                              <div>
                                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Vincular a Docente Existente</label>
                                  <select name="docente" value={formData.docente} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600" required>
                                      <option value="">Seleccione un docente</option>
                                      {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre_completo}</option>)}
                                  </select>
                                  {errors.docente && <p className="text-xs text-red-600 mt-1">{errors.docente}</p>}
                              </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" onClick={() => setIsCreating(false)} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105">
                  {isSubmitting ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        )}
 
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
                {usuarios.map(usuario => (
                  <tr key={usuario.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-white">{usuario.username}</div>
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
