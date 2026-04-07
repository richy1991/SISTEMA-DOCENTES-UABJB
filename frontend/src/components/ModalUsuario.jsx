import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';

// Componente Select con Dropdown animado (igual que en ListaDocentes)
const SelectConDropdown = ({ label, name, value, onChange, options, error, disabled = false, required = false, placeholder = 'Seleccione...' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selectedLabel = options.find(opt => opt.value === value)?.label;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-2xl text-left flex items-center justify-between transition-all ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
        } ${
          error
            ? 'border-2 border-red-500 bg-white dark:bg-slate-800'
            : open
              ? 'border-2 border-[#2C4AAE] bg-white dark:bg-slate-800'
                : 'border-2 border-slate-400 bg-slate-100 dark:bg-slate-700 hover:border-[#2C4AAE]'
        }`}
      >
        <span className={`${selectedLabel ? 'text-slate-800 dark:text-white font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedLabel || placeholder}
        </span>
        <div className="w-8 h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors">
          <svg
            className={`w-4 h-4 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange({ target: { name, value: option.value } });
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? 'bg-[#2C4AAE] text-white font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const ToggleSwitch = ({ isActive, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-500 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const ModalUsuario = ({ isOpen, onClose, onSaveSuccess, userToEdit, docentes, carreras, roles, sidebarCollapsed = false, hasSidebar = true, currentUser }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [asignacionesExtra, setAsignacionesExtra] = useState([]);
  const [crearNuevoDocente, setCrearNuevoDocente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const asignacionesUsuario = Array.isArray(userToEdit?.asignaciones) ? userToEdit.asignaciones : [];
    const rolPrincipal = userToEdit?.perfil?.rol || 'docente';
    const carreraPrincipal = userToEdit?.perfil?.carrera || '';
    const docentePrincipal = userToEdit?.perfil?.docente_id || '';
    let principalConsumida = false;
    const extras = asignacionesUsuario
      .filter((item) => {
        const coincidePrincipal = (
          String(item?.rol || '') === String(rolPrincipal)
          && String(item?.carrera || '') === String(carreraPrincipal)
          && String(item?.docente || '') === String(docentePrincipal)
        );
        if (!principalConsumida && coincidePrincipal) {
          principalConsumida = true;
          return false;
        }
        return true;
      })
      .map((item) => ({
        rol: item?.rol || 'docente',
        carrera: item?.carrera || '',
        docente: item?.docente || '',
      }));

    const initialData = {
      username: userToEdit?.username || '',
      email: userToEdit?.email || '',
      first_name: userToEdit?.first_name || '',
      last_name: userToEdit?.last_name || '',
      ci: userToEdit?.ci || '',
      rol: userToEdit?.perfil?.rol || 'docente',
      carrera: userToEdit?.perfil?.carrera || '',
      docente: userToEdit?.perfil?.docente_id || '',
    };

    setFormData(initialData);
    setAsignacionesExtra(extras);
    setCrearNuevoDocente(false);
    setErrors({});
    setShowResetConfirm(false);
  }, [userToEdit]);

  useEffect(() => {
    if (!userToEdit) return;

    try {
      const datosEditarGuardados = sessionStorage.getItem('datosEditarUsuario');
      const docenteRetornadoRaw = sessionStorage.getItem('docenteRetornadoDesdeUsuarios');
      
      // Solo recuperar si el userId coincide exactamente
      if (datosEditarGuardados) {
        const datos = JSON.parse(datosEditarGuardados);
        if (datos.userId === userToEdit.id && datos.formData) {
          const docenteRetornado = docenteRetornadoRaw ? JSON.parse(docenteRetornadoRaw) : null;
          setFormData((prev) => ({
            ...prev,
            ...datos.formData,
            ci: docenteRetornado?.ci || datos.formData.ci || '',
            docente: docenteRetornado?.id || datos.formData.docente || '',
            carrera: docenteRetornado?.carrera || datos.formData.carrera || prev.carrera || '',
          }));
        }
      }
    } catch (e) {
      console.error('Error al recuperar formulario de edición:', e);
    } finally {
      // Siempre limpiar al cambiar de usuario
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
    const esAdminCarrera = currentUser?.perfil?.rol === 'admin' && !currentUser?.is_superuser;
    
    setFormData((prev) => ({
      ...prev,
      rol: newRol,
      // Admin de carrera siempre mantiene su carrera, otros roles la pierden al cambiar
      carrera: (newRol === 'admin' || newRol === 'director' || newRol === 'jefe_estudios') 
        ? (esAdminCarrera ? currentUser?.perfil?.carrera : prev.carrera) 
        : (newRol === 'docente' ? prev.carrera : ''),
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
        carrera: formData.carrera || '',
      })
    );
    sessionStorage.setItem('abrirModalDesdeUsuarios', 'true');
    onClose();
    navigate('/fondo-tiempo/docentes');
  };

  const handleAsignacionChange = (index, field, value) => {
    setAsignacionesExtra((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const MAX_ASIGNACIONES_TOTAL = 2;
  const totalAsignaciones = 1 + asignacionesExtra.length;
  const puedeAgregarAsignacion = totalAsignaciones < MAX_ASIGNACIONES_TOTAL;

  const agregarAsignacion = () => {
    if (!puedeAgregarAsignacion) return;
    setAsignacionesExtra((prev) => ([...prev, { rol: 'docente', carrera: '', docente: '' }]));
  };

  const eliminarAsignacion = (index) => {
    setAsignacionesExtra((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const tieneDocenteVinculado = Boolean(userToEdit?.perfil?.docente_id);
  const nombreDocenteVinculado = userToEdit?.perfil?.docente_nombre || 'Sin nombre';
  const esSuperusuarioEditado = Boolean(userToEdit?.is_superuser);
  const mostrarOpcionesVinculacion = formData.rol === 'docente' && !tieneDocenteVinculado;
  const mostrarInfoDocente = formData.rol === 'docente' && tieneDocenteVinculado;
  const mostrarCiAutoridad = formData.rol === 'admin' || formData.rol === 'director' || formData.rol === 'jefe_estudios';

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

    const esUsuarioSistema = ['admin', 'director', 'jefe_estudios'].includes(formData.rol);
    const ciNormalizado = (formData.ci || '').trim();

    if (esUsuarioSistema && !ciNormalizado) {
      setErrors((prev) => ({
        ...prev,
        ci: ['El C.I. es obligatorio para este tipo de usuario.'],
      }));
      toast.error('El C.I. es obligatorio para este tipo de usuario.');
      setLoading(false);
      return;
    }

    const docenteId = formData.rol === 'docente' ? Number(formData.docente) : null;
    if (formData.rol === 'docente' && !docenteId) {
      setErrors((prev) => ({
        ...prev,
        docente: ['Debe seleccionar un docente para vincular.'],
      }));
      toast.error('Debe seleccionar un docente para vincular.');
      setLoading(false);
      return;
    }

    const payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      ci: ciNormalizado || null,
      rol: formData.rol,
      is_active: userToEdit.is_active,
      asignaciones: asignacionesExtra,
    };

    // Admin, Director y Jefe de Estudios deben enviar carrera
    if ((formData.rol === 'admin' || formData.rol === 'director' || formData.rol === 'jefe_estudios') && !esSuperusuarioEditado) {
      payload.carrera = formData.carrera;
    } else if (formData.rol === 'docente') {
      payload.docente = docenteId;
      if (formData.carrera) {
        payload.carrera = formData.carrera;
      }
    }

    try {
      const response = await api.put(`/usuarios/${userToEdit.id}/`, payload);

      if (formData.rol === 'docente' && !response?.data?.perfil?.docente_id) {
        toast.error('No se pudo vincular el docente al usuario. Intenta nuevamente.');
        setErrors((prev) => ({
          ...prev,
          docente: ['El usuario se actualizo pero no quedo vinculado al docente.'],
        }));
        return;
      }

      toast.success('Usuario actualizado correctamente');
      onSaveSuccess(response.data);
    } catch (err) {
      console.error('Error al guardar usuario:', err);
      const apiErrors = err.response?.data;
      let errorMsg = 'Ocurrió un error inesperado.';

      if (apiErrors && typeof apiErrors === 'object') {
        setErrors(apiErrors);
        const rolError = Array.isArray(apiErrors?.rol)
          ? apiErrors.rol[0]
          : (typeof apiErrors?.rol === 'string' ? apiErrors.rol : null);
        if (rolError) {
          errorMsg = rolError;
        }

        const errorMessages = [];
        
        Object.entries(apiErrors).forEach(([field, messages]) => {
          const msgs = Array.isArray(messages) ? messages : [messages];
          msgs.forEach(msg => {
            const msgStr = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : String(msg);
            if (msgStr.trim()) {
              const fieldLabel = field === 'non_field_errors' ? '' : `${field}: `;
              errorMessages.push(`${fieldLabel}${msgStr.trim()}`);
            }
          });
        });
        
        // Limitar a los primeros 2 errores
        if (!rolError) {
          errorMsg = errorMessages.slice(0, 2).join('; ') || 'Error de validación.';
        }
      } else if (err.response?.data && typeof err.response.data === 'string') {
        if (err.response.data.includes('<!DOCTYPE html>') || err.response.data.includes('<html')) {
          errorMsg = 'Error interno del servidor al actualizar usuario. Vuelve a intentar o reporta este caso.';
        } else {
          errorMsg = err.response.data;
        }
      } else if (err.message) {
        errorMsg = `Error de red: ${err.message}`;
      }

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !userToEdit) return null;

  return createPortal(
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0' }}
    >
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="bg-[#2C4AAE] px-6 py-4 rounded-t-2xl dark:bg-[#1a3a8a]">
          <h3 className="text-xl font-bold text-white">
            Editar Usuario
          </h3>
        </div>

        <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-visible">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Usuario" name="username" value={formData.username} onChange={handleChange} required disabled={!!userToEdit} error={errors.username} />
              <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
              <InputField label="Nombres" name="first_name" value={formData.first_name} onChange={handleChange} required error={errors.first_name} />
              <InputField label="Apellidos" name="last_name" value={formData.last_name} onChange={handleChange} required error={errors.last_name} />

              <div>
                <SelectConDropdown
                  label="Rol"
                  name="rol"
                  value={formData.rol}
                  onChange={handleRolChange}
                  options={(roles || []).filter((rol) => currentUser?.is_superuser || rol.value !== 'admin').map((rol) => ({ value: rol.value, label: rol.label }))}
                  error={errors.rol}
                  disabled={esSuperusuarioEditado}
                  required
                />
              </div>

              {formData.rol === 'docente' && !esSuperusuarioEditado && !mostrarOpcionesVinculacion && (
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Contrasena inicial</label>
                  <div className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                    {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                  </div>
                </div>
              )}

              {mostrarCiAutoridad && esSuperusuarioEditado && (
                <InputField label="C.I." name="ci" value={formData.ci} onChange={handleChange} error={errors.ci} />
              )}

              {mostrarCiAutoridad && !esSuperusuarioEditado && (
                <div>
                  <SelectConDropdown
                    label="Carrera"
                    name="carrera"
                    value={formData.carrera}
                    onChange={handleChange}
                    options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                    error={errors.carrera}
                    disabled={currentUser?.perfil?.rol === 'admin' && !currentUser?.is_superuser}
                    required
                  />
                  {currentUser?.perfil?.rol === 'admin' && !currentUser?.is_superuser && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Carrera asignada automaticamente (no puedes cambiarla)
                    </p>
                  )}
                </div>
              )}

              {mostrarOpcionesVinculacion && !crearNuevoDocente && (
                <div>
                  <SelectConDropdown
                    label="Vincular a Docente Existente"
                    name="docente"
                    value={formData.docente}
                    onChange={handleChange}
                    options={docentes.map((d) => ({ value: d.id, label: d.nombre_completo }))}
                    error={errors.docente}
                    placeholder="Seleccione un docente"
                  />
                </div>
              )}

              {mostrarCiAutoridad && !esSuperusuarioEditado && (
                <div className="md:col-span-2">
                  <div className={`grid gap-4 ${esSuperusuarioEditado ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <InputField label="C.I." name="ci" value={formData.ci} onChange={handleChange} error={errors.ci} />
                    {!esSuperusuarioEditado && (
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Contrasena inicial</label>
                        <div className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                          {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.rol === 'docente' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                    Crear nuevo registro de docente
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-center rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 w-3/4 mx-auto">
                      <ToggleSwitch
                        isActive={crearNuevoDocente}
                        onChange={() => {
                          if (!crearNuevoDocente) {
                            setCrearNuevoDocente(true);
                            handleCrearNuevoDocente();
                          } else {
                            setCrearNuevoDocente(false);
                          }
                        }}
                      />
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                      {mostrarInfoDocente ? (
                        <>Docente vinculado: {nombreDocenteVinculado}</>
                      ) : (
                        <>Aun no hay docente vinculado.</>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2 mt-2">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">Asignaciones adicionales</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cada bloque define rol y carrera de forma independiente.</p>
                  </div>
                  <button
                    type="button"
                    onClick={agregarAsignacion}
                    disabled={!puedeAgregarAsignacion}
                    className={`rounded-xl px-3 py-2 font-semibold text-white transition-colors ${puedeAgregarAsignacion ? 'bg-[#2C4AAE] hover:bg-[#1a3a8a]' : 'bg-slate-400 cursor-not-allowed'}`}
                  >
                    +
                  </button>
                </div>
                {!puedeAgregarAsignacion && (
                  <p className="mb-3 text-xs text-amber-600 dark:text-amber-300">
                    Límite alcanzado: máximo 2 asignaciones totales por usuario.
                  </p>
                )}

                {asignacionesExtra.length > 0 && (
                  <div className="space-y-4">
                    {asignacionesExtra.map((asignacion, index) => (
                      <div key={`${index}-${asignacion.rol}-${asignacion.carrera}`} className="space-y-4 rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bloque {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => eliminarAsignacion(index)}
                            className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                          >
                            Eliminar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <SelectConDropdown
                            label="Rol"
                            name={`asignacion-rol-${index}`}
                            value={asignacion.rol || 'docente'}
                            onChange={(e) => handleAsignacionChange(index, 'rol', e.target.value)}
                            options={(roles || []).filter((rol) => currentUser?.is_superuser || rol.value !== 'admin').map((rol) => ({ value: rol.value, label: rol.label }))}
                            error={errors[`asignaciones.${index}.rol`]}
                            required
                          />

                          <SelectConDropdown
                            label="Carrera"
                            name={`asignacion-carrera-${index}`}
                            value={asignacion.carrera || ''}
                            onChange={(e) => handleAsignacionChange(index, 'carrera', e.target.value)}
                            options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                            error={errors[`asignaciones.${index}.carrera`]}
                            required
                          />

                          {asignacion.rol === 'docente' && (
                            <div className="md:col-span-2">
                              <SelectConDropdown
                                label="Docente"
                                name={`asignacion-docente-${index}`}
                                value={asignacion.docente || ''}
                                onChange={(e) => handleAsignacionChange(index, 'docente', e.target.value)}
                                options={docentes.map((d) => ({ value: d.id, label: d.nombre_completo }))}
                                error={errors[`asignaciones.${index}.docente`]}
                                placeholder="Seleccione un docente"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-700 border-t border-slate-300 dark:border-slate-600 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div>
              {userToEdit && !esSuperusuarioEditado && (
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
                className="px-6 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={loading}
                className={`px-6 py-2.5 rounded-xl font-bold text-white bg-[#2C4AAE] hover:bg-[#1a3a8a] transition-all disabled:opacity-50 ${
                  loading
                    ? 'cursor-not-allowed'
                    : ''
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
    </div>,
    document.body
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
      className={`w-full rounded-xl border-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white px-4 py-3 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500' : 'border-slate-400 dark:border-slate-600'
      } ${(disabled || readOnly) ? 'cursor-not-allowed bg-slate-200 dark:bg-slate-700/50' : ''}`}
    />
    {error && <p className="mt-1 text-xs text-red-600">{Array.isArray(error) ? error[0] : error}</p>}
  </div>
);

export default ModalUsuario;
