import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getDocentes, getCarreras, crearFondoTiempo, getCalendarioActivo, getCalendarios } from '../apis/api';
import api from '../apis/api';
import axios from 'axios';
import toast from 'react-hot-toast';

function FormularioFondo({ isDark, editar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [docentes, setDocentes] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [calendarios, setCalendarios] = useState([]);
  const [calendarioActivo, setCalendarioActivo] = useState(null);
  const [nombreDocenteMostrado, setNombreDocenteMostrado] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(editar);
  const [error, setError] = useState('');
  const [erroresCampos, setErroresCampos] = useState({});  
  
  const [formData, setFormData] = useState({
    docente: '',
    carrera: '',
    calendario_academico: '',
    gestion: new Date().getFullYear(),
    periodo: '',
    asignatura: '',
    tiene_programa_analitico: false,
    programa_analitico_url: '',
    estado: 'borrador',
  });

  useEffect(() => {
    cargarDatos();
    if (editar && id) {
      cargarFondo();
    }
  }, [id, editar]);

  const cargarDatos = async () => {
    try {
      let docenteId = null;

      // 1. Prioridad: Datos por navegación (Jefe de Estudios asignando a un docente)
      if (location.state?.docenteId && location.state?.docenteNombre) {
        setNombreDocenteMostrado(location.state.docenteNombre);
        docenteId = location.state.docenteId;
      } else {
        // 2. Fallback: Usuario logueado (Docente auto-gestionando)
        const userResponse = await api.get('/usuario/');
        const userData = userResponse.data;      
        
        if (userData.perfil?.docente_nombre) {
          setNombreDocenteMostrado(userData.perfil.docente_nombre);
        }
        if (userData.perfil?.docente) {
          docenteId = userData.perfil.docente;
        }
      }
      
      const [docentesRes, carrerasRes, calendariosRes] = await Promise.all([
        getDocentes(),
        getCarreras(),
        getCalendarios()
      ]);

      const docentesList = docentesRes.data.results || docentesRes.data;
      
      setDocentes(docentesRes.data.results || docentesRes.data);
      setCarreras(carrerasRes.data.results || carrerasRes.data);
      setCalendarios(calendariosRes.data.results || calendariosRes.data);

      try {
        const calendarioActivoRes = await getCalendarioActivo();
        setCalendarioActivo(calendarioActivoRes.data);
        
        if (!editar && calendarioActivoRes.data) {
          setFormData(prev => ({
            ...prev,
            calendario_academico: calendarioActivoRes.data.id,
            gestion: calendarioActivoRes.data.gestion,
            periodo: calendarioActivoRes.data.periodo,
            ...(docenteId && { docente: docenteId }) // Usar el ID resuelto
          }));
        }
      } catch (err) {
        console.warn('No hay calendario activo configurado');
      }

    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos iniciales');
      toast.error('❌ Error al cargar los datos iniciales');
    }
  };

  const cargarFondo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `http://127.0.0.1:8000/api/fondos-tiempo/${id}/`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const fondo = response.data;
      setFormData({
        docente: fondo.docente,
        carrera: fondo.carrera,
        calendario_academico: fondo.calendario_academico || '',
        gestion: fondo.gestion,
        periodo: fondo.periodo || '',
        asignatura: fondo.asignatura,
        tiene_programa_analitico: fondo.tiene_programa_analitico || false,
        programa_analitico_url: fondo.programa_analitico_url || '',
        estado: fondo.estado,
      });
      setLoadingDatos(false);
    } catch (err) {
      console.error('Error al cargar fondo:', err);
      setError('Error al cargar el fondo de tiempo');
      toast.error('❌ Error al cargar el fondo de tiempo');
      setLoadingDatos(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };

      if (name === 'calendario_academico' && value) {
        const calendarioSeleccionado = calendarios.find(c => c.id === parseInt(value));
        if (calendarioSeleccionado) {
          updated.gestion = calendarioSeleccionado.gestion;
          updated.periodo = calendarioSeleccionado.periodo;
        }
      }

      return updated;
    });
    
    if (erroresCampos[name]) {
      setErroresCampos({
        ...erroresCampos,
        [name]: ''
      });
    }
  };

  const getPeriodoLabel = (periodo) => {
    const periodos = {
      '1S': 'Primer Semestre',
      '2S': 'Segundo Semestre',
      'A': 'Anual',
      'V': 'Verano'
    };
    return periodos[periodo] || periodo;
  };

  const validarFormulario = () => {
    const errores = {};
    
    if (!formData.carrera) {
      errores.carrera = 'Debe seleccionar una carrera';
    }
    if (!formData.calendario_academico) {
      errores.calendario_academico = 'Debe seleccionar un calendario académico';
    }
    if (!formData.gestion || formData.gestion < 2020) {
      errores.gestion = 'Gestión inválida';
    }
    if (!formData.periodo) {
      errores.periodo = 'Debe seleccionar un periodo académico';
    }
    if (!formData.asignatura || formData.asignatura.trim().length < 3) {
      errores.asignatura = 'Asignatura inválida (mínimo 3 caracteres)';
    }
    if (formData.tiene_programa_analitico && !formData.programa_analitico_url) {
      errores.programa_analitico_url = 'Debe proporcionar la URL del programa analítico';
    }
    
    setErroresCampos(errores);
    return Object.keys(errores).length === 0;
  };

  const verificarDuplicado = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `http://127.0.0.1:8000/api/fondos-tiempo/`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            docente: formData.docente,
            gestion: formData.gestion,
            periodo: formData.periodo,
            asignatura: formData.asignatura
          }
        }
      );
      
      const fondos = response.data.results || response.data;
      
      const duplicados = fondos.filter(f => 
        (!editar || f.id !== parseInt(id)) &&
        f.docente === parseInt(formData.docente) &&
        f.gestion === parseInt(formData.gestion) &&
        f.periodo === formData.periodo &&
        f.asignatura.toLowerCase() === formData.asignatura.toLowerCase()
      );
      
      return duplicados.length > 0;
    } catch (err) {
      console.error('Error al verificar duplicados:', err);
      return false;
    }
  };

  const simplificarMensajeError = (mensaje) => {
    if (mensaje.toLowerCase().includes('conjunto único') || 
        mensaje.toLowerCase().includes('unique') ||
        mensaje.toLowerCase().includes('duplicado') ||
        mensaje.toLowerCase().includes('ya existe')) {
      return '⚠️ Ya existe un fondo de tiempo con estos datos. No se permiten duplicados.';
    }
    return mensaje;
  };

  const extraerMensajeValidacion = (data) => {
    if (!data) return 'Datos inválidos.';
    if (typeof data === 'string') return data;
    if (data.error && typeof data.error === 'string') return data.error;
    if (data.detail && typeof data.detail === 'string') return data.detail;
    if (data.non_field_errors && Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors[0];
    }

    if (typeof data === 'object') {
      const primerCampo = Object.keys(data)[0];
      const primerError = data[primerCampo];
      if (Array.isArray(primerError) && primerError.length > 0) return String(primerError[0]);
      if (typeof primerError === 'string') return primerError;
      if (typeof primerError === 'object' && primerError !== null) {
        const subValor = Object.values(primerError)[0];
        if (Array.isArray(subValor) && subValor.length > 0) return String(subValor[0]);
        if (typeof subValor === 'string') return subValor;
      }
    }

    return 'Datos inválidos.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const esValido = validarFormulario();
    
    if (!esValido) {
      setError('Por favor, corrija los errores en el formulario');
      toast.error('⚠️ Por favor, corrija los errores en el formulario');
      return;
    }
    
    if (!editar) {
      const esDuplicado = await verificarDuplicado();
      
      if (esDuplicado) {
        const mensajeError = '⚠️ Ya existe un fondo de tiempo con estos datos (mismo docente, gestión, periodo y asignatura). No se permiten duplicados.';
        setError(mensajeError);
        toast.error(mensajeError, {
          duration: 6000,
          icon: '❌',
          position: 'top-right',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        docente: (formData.docente && typeof formData.docente === 'object') ? formData.docente.id : formData.docente,
        carrera: (formData.carrera && typeof formData.carrera === 'object') ? formData.carrera.id : formData.carrera,
        calendario_academico: parseInt(formData.calendario_academico),
      };
      
      if (editar && id) {
        await api.put(`/fondos-tiempo/${id}/`, payload);
        toast.success('✅ Fondo de tiempo actualizado exitosamente');
      } else {
        await crearFondoTiempo(payload);
        toast.success('✅ Fondo de tiempo creado exitosamente');
      }
      
      setTimeout(() => {
        navigate('/fondo-tiempo');
      }, 1000);
      
    } catch (err) {
      console.error('❌ Error completo:', err);
      
      setErroresCampos({});
      
      let mensajeError = `Error al ${editar ? 'actualizar' : 'crear'} el fondo de tiempo.`;
      
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        if (status === 400) {
          const mensajeEspecifico = simplificarMensajeError(extraerMensajeValidacion(data));
          const mensajeValidacion = `ERROR DE VALIDACIÓN: ${mensajeEspecifico}`;
          setError(mensajeValidacion);
          toast.error(mensajeValidacion, {
            duration: 7000,
            icon: '⛔',
            position: 'top-right',
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } else if (status === 403) {
          mensajeError = '🚫 No tienes permisos para realizar esta acción';
        } else if (status === 404) {
          mensajeError = '❓ El fondo de tiempo no existe';
        } else if (status === 500) {
          mensajeError = '⚠️ Error en el servidor. Intenta nuevamente más tarde.';
        }
      } else if (err.request) {
        mensajeError = '📡 No se pudo conectar con el servidor. Verifica tu conexión.';
      }
      
      const mensajeSimplificado = simplificarMensajeError(mensajeError);
      
      setError(mensajeSimplificado);
      
      toast.error(mensajeSimplificado, {
        duration: 6000,
        icon: '❌',
        position: 'top-right',
      });
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } finally {
      setLoading(false);
    }
  };

  if (loadingDatos) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando datos del fondo...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                {editar ? '✏️ Editar Fondo de Tiempo' : '➕ Crear Nuevo Fondo de Tiempo'}
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Complete la información requerida para el fondo de tiempo docente.
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-slate-300 dark:border-slate-600"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg">
          <div className="px-6 py-5 border-b-2 border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Información General del Fondo
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Complete los detalles principales. Los campos marcados con * son obligatorios.
            </p>
          </div>
          <div className="p-6 space-y-8">
              
              {/* Mensaje de error global */}
              {error && (
                <div className="mb-6 p-4 rounded-xl border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-rose-50/30 dark:from-red-900/20 dark:to-rose-900/10 shadow-sm">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Campo Docente */}
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Docente
                        </label>
                        <div className="relative">
                          <div className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 shadow-sm cursor-not-allowed flex items-center gap-2 font-medium">
                            {nombreDocenteMostrado || 'Cargando...'}
                          </div>
                          <div className="absolute -top-2 right-3 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full shadow-md">
                            Asignado
                          </div>
                        </div>
                      </div>

                      {/* Carrera */}
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Carrera {erroresCampos.carrera && <span className="text-red-500">*</span>}
                        </label>
                        <select
                          name="carrera"
                          value={formData.carrera}
                          onChange={handleChange}
                          required
                          disabled={loading || editar}
                          className={`w-full px-4 py-3 rounded-xl border-2 ${
                            erroresCampos.carrera ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                          } bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm`}
                        >
                          <option value="">Seleccione una carrera</option>
                          {carreras.map(carrera => (
                            <option key={carrera.id} value={carrera.id}>
                              {carrera.nombre}
                            </option>
                          ))}
                        </select>
                        {erroresCampos.carrera && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.carrera}</p>
                        )}
                      </div>

                      {/* Calendario */}
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Calendario Académico {erroresCampos.calendario_academico && <span className="text-red-500">*</span>}
                          {calendarioActivo && formData.calendario_academico == calendarioActivo.id && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Activo
                            </span>
                          )}
                        </label>
                        <select
                          name="calendario_academico"
                          value={formData.calendario_academico}
                          onChange={handleChange}
                          required
                          disabled={loading || editar}
                          className={`w-full px-4 py-3 rounded-xl border-2 ${
                            erroresCampos.calendario_academico ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                          } bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm`}
                        >
                          <option value="">Seleccione un calendario académico</option>
                          {calendarios.map((calendario) => (
                            <option key={calendario.id} value={calendario.id}>
                              {calendario.gestion} - {getPeriodoLabel(calendario.periodo)}
                              {calendario.activo && ' (Activo)'}
                              {' | '}
                              {calendario.semanas_efectivas} semanas
                            </option>
                          ))}
                        </select>
                        {erroresCampos.calendario_academico && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.calendario_academico}</p>
                        )}
                      </div>

                      {/* Asignatura */}
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Nombre de la Asignatura {erroresCampos.asignatura && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          name="asignatura"
                          value={formData.asignatura}
                          onChange={handleChange}
                          required
                          disabled={loading || editar}
                          placeholder="Ej: Programación Web, Álgebra II, etc."
                          className={`w-full px-4 py-3 rounded-xl border-2 ${
                            erroresCampos.asignatura ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                          } bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm`}
                        />
                        {erroresCampos.asignatura && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.asignatura}</p>
                        )}
                      </div>
                      {/* Gestión y Periodo */}
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                            Gestión (Año)
                          </label>
                          <input
                            type="number"
                            value={formData.gestion}
                            readOnly
                            disabled                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 shadow-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                            Periodo
                          </label>
                          <input
                            type="text"
                            value={formData.periodo ? getPeriodoLabel(formData.periodo) : ''}
                            readOnly
                            disabled
                            placeholder="Automático"                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 placeholder-slate-500 shadow-sm"
                          />
                        </div>
              </div>

              <div className="pt-8 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span>Programa Analítico</span>
                    </h3>

                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="tiene_programa_analitico"
                          name="tiene_programa_analitico"
                          checked={formData.tiene_programa_analitico}
                          onChange={handleChange}
                          disabled={loading}                          
                          className="mt-1 w-5 h-5 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
                        />
                        <label htmlFor="tiene_programa_analitico" className="text-sm text-slate-800 dark:text-slate-300">
                          <span className="font-semibold">Tengo el programa analítico de la asignatura</span>
                          <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                            Obligatorio para presentar el fondo al Director (Art. 18)
                          </p>
                        </label>
                      </div>

                      {formData.tiene_programa_analitico && (
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                            URL del Programa {erroresCampos.programa_analitico_url && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="url"
                            name="programa_analitico_url"
                            value={formData.programa_analitico_url}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="https://drive.google.com/file/d/..."
                            className={`w-full px-4 py-3 rounded-xl border-2 ${
                              erroresCampos.programa_analitico_url ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                            } bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm`}
                          />
                          {erroresCampos.programa_analitico_url && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.programa_analitico_url}</p>
                          )}
                          {formData.programa_analitico_url && (
                            <a 
                              href={formData.programa_analitico_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Abrir enlace del programa
                            </a>
                          )}
                        </div>
                      )}
                    </div>
              </div>

                  {/* Nota final */}
                  <div className="p-5 rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 shadow-sm">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-blue-800 dark:text-blue-300">
                        <p className="font-bold mb-2">Resumen:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Después de crear, distribuye las 1,832 horas entre funciones</li>
                          <li>No se permiten duplicados (mismo docente, gestión y asignatura)</li>
                          <li>Solo fondos en "borrador" pueden editarse</li>
                        </ul>
                      </div>
                    </div>
                  </div>
          </div>
          {/* Footer con botones */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700 flex justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : (editar ? 'Actualizar Fondo' : 'Crear Fondo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioFondo;