import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

const UserIcon = () => (
    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const InfoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ModalUsuario = ({ isOpen, onClose, onSaveSuccess, userToEdit, docentes, carreras, roles }) => {
  const [formData, setFormData] = useState({});
  const [crearNuevoDocente, setCrearNuevoDocente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const initialData = {
      username: userToEdit?.username || '',
      email: userToEdit?.email || '',
      first_name: userToEdit?.first_name || '',
      last_name: userToEdit?.last_name || '',
      rol: userToEdit?.perfil?.rol || 'docente',
      carrera: userToEdit?.perfil?.carrera || '',
      docente: userToEdit?.perfil?.docente || '',
      password: '',
      password_confirm: '',
      docente_data: {
        nombres: '',
        apellido_paterno: '',
        apellido_materno: '',
        ci: '',
        categoria: 'catedratico',
        dedicacion: 'tiempo_completo',
        horas_contrato_semanales: null,
      }
    };
    setFormData(initialData);
    setCrearNuevoDocente(false);
    setErrors({});
  }, [userToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // AUTOMATIZACIÓN: Si estamos creando un docente nuevo, copiamos los datos del usuario
      if (crearNuevoDocente) {
        if (name === 'first_name') {
          updated.docente_data = { ...prev.docente_data, nombres: value };
        }
        if (name === 'last_name') {
          const parts = value.trim().split(' ');
          const paterno = parts[0] || '';
          const materno = parts.slice(1).join(' ') || '';
          updated.docente_data = { 
            ...prev.docente_data, 
            apellido_paterno: paterno,
            apellido_materno: materno 
          };
        }
      }
      return updated;
    });
  };

  const handleCheckboxChange = (e) => {
    const isChecked = e.target.checked;
    setCrearNuevoDocente(isChecked);
    
    if (isChecked) {
      setFormData(prev => {
        const parts = (prev.last_name || '').trim().split(' ');
        const paterno = parts[0] || '';
        const materno = parts.slice(1).join(' ') || '';
        return {
          ...prev,
          docente_data: {
            ...prev.docente_data,
            nombres: prev.first_name || '',
            apellido_paterno: paterno,
            apellido_materno: materno
          }
        };
      });
    }
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
    setLoading(true);
    setErrors({});

    let payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      rol: formData.rol,
    };

    if (userToEdit) { // Edit mode
      payload.is_active = userToEdit.is_active;
    } else { // Create mode
      payload.password = formData.password;
      payload.password_confirm = formData.password_confirm;
    }

    if (formData.rol === 'director' || formData.rol === 'jefe_estudios') {
      payload.carrera = formData.carrera;
    } else if (formData.rol === 'docente') {
      if (crearNuevoDocente) {
        payload.docente_data = formData.docente_data;
      } else {
        payload.docente = formData.docente;
      }
    }

    try {
      if (userToEdit) {
        await api.put(`/usuarios/${userToEdit.id}/`, payload);
        toast.success('Usuario actualizado correctamente');
      } else {
        await api.post('/usuarios/', payload);
        toast.success('Usuario creado correctamente');
      }
      onSaveSuccess();
      // La función onSaveSuccess ya se encarga de cerrar el modal,
      // por lo que la llamada a onCancel/onClose aquí es innecesaria y se elimina.
    } catch (err) {
      console.error('Error al guardar usuario:', err); // Logueamos el objeto de error completo para un mejor diagnóstico.
      const apiErrors = err.response?.data;
      let errorMsg = 'Ocurrió un error inesperado.'; // Mensaje por defecto.

      if (apiErrors && typeof apiErrors === 'object') {
        // Extraer mensajes de error de la respuesta de la API (DRF).
        setErrors(apiErrors);
        errorMsg = Object.values(apiErrors).flat().join(' ');
      } else if (err.response?.data && typeof err.response.data === 'string') {
        // Si la respuesta de error es solo un texto.
        errorMsg = err.response.data;
      } else if (err.message) {
        // Para errores de red donde no hay `err.response`.
        errorMsg = `Error de red: ${err.message}`;
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        <div className="px-6 py-4 border-b-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
            <h3 className="text-xl font-bold text-blue-600 dark:text-white flex items-center gap-2">
                <span>{userToEdit ? '✏️' : '➕'}</span>
                {userToEdit ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
            </h3>
            <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Cerrar">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <InputField label="Usuario" name="username" value={formData.username} onChange={handleChange} required disabled={!!userToEdit} error={errors.username} />
              <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
              {!userToEdit && (
                <>
                  <InputField label="Contraseña" name="password" type="password" value={formData.password} onChange={handleChange} required error={errors.password} />
                  <InputField label="Confirmar Contraseña" name="password_confirm" type="password" value={formData.password_confirm} onChange={handleChange} required error={errors.password_confirm} />
                </>
              )}
              <InputField label="Nombres" name="first_name" value={formData.first_name} onChange={handleChange} required error={errors.first_name} />
              <InputField label="Apellidos" name="last_name" value={formData.last_name} onChange={handleChange} required error={errors.last_name} />
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div className="form-group">
                <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Rol</label>
                <select name="rol" value={formData.rol} onChange={handleRolChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600" required>
                  <option value="" disabled>Seleccione un rol</option>
                  {roles && roles.map(rol => (
                    <option key={rol.value} value={rol.value}>{rol.label}</option>
                  ))}
                </select>
                {errors.rol && <p className="text-xs text-red-600 mt-1">{errors.rol}</p>}
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
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={crearNuevoDocente} onChange={handleCheckboxChange} />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Crear nuevo registro de docente</span>
                  </label>

                  {crearNuevoDocente ? (
                    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                      <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300">Datos del Nuevo Docente</h4>
                      <InputField label="Nombres Docente" name="nombres" value={formData.docente_data.nombres} onChange={handleDocenteDataChange} required error={errors.docente_data?.nombres} />
                      <InputField label="Apellido Paterno Docente" name="apellido_paterno" value={formData.docente_data.apellido_paterno} onChange={handleDocenteDataChange} required error={errors.docente_data?.apellido_paterno} />
                      <InputField label="Apellido Materno Docente" name="apellido_materno" value={formData.docente_data.apellido_materno} onChange={handleDocenteDataChange} error={errors.docente_data?.apellido_materno} />
                      <InputField label="CI Docente" name="ci" value={formData.docente_data.ci} onChange={handleDocenteDataChange} required error={errors.docente_data?.ci} />
                      <div className="form-group">
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Categoría</label>
                        <select name="categoria" value={formData.docente_data.categoria} onChange={handleDocenteDataChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                            <option value="catedratico">Catedrático</option>
                            <option value="adjunto">Adjunto</option>
                            <option value="asistente">Asistente</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Dedicación</label>
                        <select name="dedicacion" value={formData.docente_data.dedicacion} onChange={handleDocenteDataChange} className="w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600">
                            <option value="tiempo_completo">Tiempo Completo</option>
                            <option value="horario">Horario</option>
                            <option value="medio_tiempo">Medio Tiempo</option>
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
        </form>
        <div className="border-t-2 border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50">Cancelar</button>
                <button type="submit" form="user-form" disabled={loading} className={`px-6 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105'}`}>
                    {loading ? 'Guardando...' : (userToEdit ? 'Actualizar Usuario' : 'Crear Usuario')}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

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
      className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} ${disabled ? 'bg-slate-200 dark:bg-slate-700/50 cursor-not-allowed' : ''}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{Array.isArray(error) ? error[0] : error}</p>}
  </div>
);

export default ModalUsuario;