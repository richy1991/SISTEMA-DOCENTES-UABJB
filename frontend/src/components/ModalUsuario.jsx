import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';

const ModalUsuario = ({ isOpen, onClose, onSaveSuccess, userToEdit, docentes, carreras, roles }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [crearNuevoDocente, setCrearNuevoDocente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const initialData = {
      username: userToEdit?.username || '',
      email: userToEdit?.email || '',
      first_name: userToEdit?.first_name || '',
      last_name: userToEdit?.last_name || '',
      ci: '',
      rol: userToEdit?.perfil?.rol || 'docente',
      carrera: userToEdit?.perfil?.carrera || '',
      docente: userToEdit?.perfil?.docente || '',
    };

    setFormData(initialData);
    setCrearNuevoDocente(false);
    setErrors({});
    setShowResetConfirm(false);
  }, [userToEdit]);

  useEffect(() => {
    if (!userToEdit) return;

    const datosEditarGuardados = sessionStorage.getItem('datosEditarUsuario');
    if (!datosEditarGuardados) return;

    try {
      const datos = JSON.parse(datosEditarGuardados);
      if (datos.userId === userToEdit.id && datos.formData) {
        const docenteRetornadoRaw = sessionStorage.getItem('docenteRetornadoDesdeUsuarios');
        const docenteRetornado = docenteRetornadoRaw ? JSON.parse(docenteRetornadoRaw) : null;
        setFormData({
          ...datos.formData,
          ci: docenteRetornado?.ci || datos.formData.ci || '',
          docente: docenteRetornado?.id || datos.formData.docente || '',
        });
      }
    } catch (e) {
      console.error('Error al recuperar formulario de edición:', e);
    } finally {
      sessionStorage.removeItem('datosEditarUsuario');
      sessionStorage.removeItem('docenteRetornadoDesdeUsuarios');
    }
  }, [userToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRolChange = (e) => {
    const newRol = e.target.value;
    setFormData((prev) => ({
      ...prev,
      rol: newRol,
      carrera: newRol === 'director' || newRol === 'jefe_estudios' ? prev.carrera : '',
      docente: newRol === 'docente' ? prev.docente : '',
    }));
    if (newRol !== 'docente') {
      setCrearNuevoDocente(false);
    }
  };

  const handleCrearNuevoDocente = () => {
    if (!userToEdit) return;

    sessionStorage.setItem(
      'datosEditarUsuario',
      JSON.stringify({
        userId: userToEdit.id,
        formData,
      })
    );

    const apellidos = (formData.last_name || '').trim().split(/\s+/).filter(Boolean);
    sessionStorage.setItem(
      'datosCrearDocente',
      JSON.stringify({
        nombres: formData.first_name || '',
        apellido_paterno: apellidos[0] || '',
        apellido_materno: apellidos.slice(1).join(' '),
        email: formData.email || '',
        telefono: '',
      })
    );
    sessionStorage.setItem('abrirModalDesdeUsuarios', 'true');
    onClose();
    navigate('/fondo-tiempo/docentes');
  };

  const tieneDocenteVinculado = Boolean(userToEdit?.perfil?.docente);
  const nombreDocenteVinculado = userToEdit?.perfil?.docente_nombre || 'Sin nombre';
  const mostrarOpcionesVinculacion = formData.rol === 'docente' && !tieneDocenteVinculado;
  const mostrarInfoDocente = formData.rol === 'docente' && tieneDocenteVinculado;
  const mostrarCiRetornado = mostrarOpcionesVinculacion && Boolean(formData.ci);

  const handleResetearPassword = async () => {
    const passwordPorDefecto = `${userToEdit.username}UABJB`;
    setResettingPassword(true);

    try {
      await api.post(`/usuarios/${userToEdit.id}/resetear_password/`);
      toast.success(`Contraseña restablecida. Nueva contraseña: ${passwordPorDefecto}`);
      setShowResetConfirm(false);
      onSaveSuccess();
    } catch (err) {
      toast.error('No se pudo restablecer la contraseña');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      rol: formData.rol,
      is_active: userToEdit.is_active,
    };

    if (formData.rol === 'director' || formData.rol === 'jefe_estudios') {
      payload.carrera = formData.carrera;
    } else if (formData.rol === 'docente') {
      payload.docente = formData.docente;
    }

    try {
      await api.put(`/usuarios/${userToEdit.id}/`, payload);
      toast.success('Usuario actualizado correctamente');
      onSaveSuccess();
    } catch (err) {
      console.error('Error al guardar usuario:', err);
      const apiErrors = err.response?.data;
      let errorMsg = 'Ocurrió un error inesperado.';

      if (apiErrors && typeof apiErrors === 'object') {
        setErrors(apiErrors);
        errorMsg = Object.values(apiErrors).flat().join(' ');
      } else if (err.response?.data && typeof err.response.data === 'string') {
        errorMsg = err.response.data;
      } else if (err.message) {
        errorMsg = `Error de red: ${err.message}`;
      }

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !userToEdit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl border-2 border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b-2 border-slate-300 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-700/50">
          <h3 className="flex items-center gap-2 text-xl font-bold text-blue-600 dark:text-white">
            <span>✏️</span>
            Editar Usuario
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
            title="Cerrar"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <InputField label="Usuario" name="username" value={formData.username} onChange={handleChange} required disabled={!!userToEdit} error={errors.username} />
              <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
              <InputField label="Nombres" name="first_name" value={formData.first_name} onChange={handleChange} required error={errors.first_name} />
              <InputField label="Apellidos" name="last_name" value={formData.last_name} onChange={handleChange} required error={errors.last_name} />
              {mostrarCiRetornado && (
                <InputField label="CI" name="ci" value={formData.ci} onChange={handleChange} readOnly />
              )}
            </div>

            <div className="space-y-4">
              <div className="form-group">
                <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-300">Rol</label>
                <select
                  name="rol"
                  value={formData.rol}
                  onChange={handleRolChange}
                  className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  required
                >
                  <option value="" disabled>Seleccione un rol</option>
                  {roles && roles.map((rol) => (
                    <option key={rol.value} value={rol.value}>{rol.label}</option>
                  ))}
                </select>
                {errors.rol && <p className="mt-1 text-xs text-red-600">{errors.rol}</p>}
              </div>

              {(formData.rol === 'director' || formData.rol === 'jefe_estudios') && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-300">Carrera</label>
                  <select
                    name="carrera"
                    value={formData.carrera}
                    onChange={handleChange}
                    className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    required
                  >
                    <option value="">Seleccione una carrera</option>
                    {carreras.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {errors.carrera && <p className="mt-1 text-xs text-red-600">{errors.carrera}</p>}
                </div>
              )}

              {mostrarOpcionesVinculacion && (
                <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/50">
                    <input
                      type="checkbox"
                      checked={crearNuevoDocente}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCrearNuevoDocente(true);
                          handleCrearNuevoDocente();
                        } else {
                          setCrearNuevoDocente(false);
                        }
                      }}
                      className="h-5 w-5 rounded text-blue-600"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Crear nuevo registro de docente
                    </span>
                  </label>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-300">Vincular a Docente Existente</label>
                    <select
                      name="docente"
                      value={formData.docente}
                      onChange={handleChange}
                      className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      required
                    >
                      <option value="">Seleccione un docente</option>
                      {docentes.map((d) => (
                        <option key={d.id} value={d.id}>{d.nombre_completo}</option>
                      ))}
                    </select>
                    {errors.docente && <p className="mt-1 text-xs text-red-600">{errors.docente}</p>}
                  </div>
                </div>
              )}

              {mostrarInfoDocente && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                  Docente vinculado: {nombreDocenteVinculado}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="border-t-2 border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              {userToEdit && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={loading || resettingPassword}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-bold shadow-sm transition-all ${
                    resettingPassword
                      ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-700'
                      : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40'
                  }`}
                  title={`Restablecer contraseña a: ${userToEdit?.username}UABJB`}
                >
                  🔑 {resettingPassword ? 'Restableciendo...' : 'Restablecer Contraseña'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border-2 border-slate-300 bg-white px-6 py-2.5 font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={loading}
                className={`flex items-center gap-2 rounded-xl px-6 py-2.5 font-bold text-white shadow-lg transition-all hover:shadow-xl ${
                  loading
                    ? 'cursor-not-allowed bg-slate-400'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {loading ? 'Guardando...' : 'Actualizar Usuario'}
              </button>
            </div>
          </div>
        </div>

        {showResetConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
              onClick={() => !resettingPassword && setShowResetConfirm(false)}
            />
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-300/40 bg-slate-900 shadow-2xl dark:border-amber-700/50">
              <div className="border-b border-slate-700/70 bg-gradient-to-r from-amber-900/30 to-slate-900 px-5 py-4">
                <h4 className="flex items-center gap-2 text-lg font-bold text-amber-300">
                  <span>🔐</span>
                  Confirmar Restablecimiento
                </h4>
              </div>
              <div className="space-y-3 px-5 py-4 text-slate-200">
                <p className="text-sm leading-relaxed">
                  Se restablecerá la contraseña de <strong className="text-white">{userToEdit?.username}</strong> a la contraseña inicial.
                </p>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  Contraseña por defecto: <strong className="text-amber-300">{userToEdit?.username}UABJB</strong>
                </div>
                <p className="text-xs text-slate-400">
                  El usuario deberá cambiarla al iniciar sesión.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-700/70 bg-slate-950/70 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resettingPassword}
                  className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetearPassword}
                  disabled={resettingPassword}
                  className={`rounded-lg px-4 py-2 font-bold text-white ${
                    resettingPassword ? 'cursor-not-allowed bg-slate-500' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {resettingPassword ? 'Restableciendo...' : 'Confirmar y Restablecer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InputField = ({ label, name, type = 'text', value, onChange, required, disabled, readOnly, error }) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-300">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      className={`w-full rounded-xl border-2 bg-slate-50 px-4 py-3 text-slate-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white ${
        error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
      } ${(disabled || readOnly) ? 'cursor-not-allowed bg-slate-200 dark:bg-slate-700/50' : ''}`}
    />
    {error && <p className="mt-1 text-xs text-red-600">{Array.isArray(error) ? error[0] : error}</p>}
  </div>
);

export default ModalUsuario;
