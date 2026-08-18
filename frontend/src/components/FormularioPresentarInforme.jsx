import { useMemo, useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/formErrors';

const CATEGORIA_LABELS = {
  academica: 'Académica',
  investigacion: 'Investigación',
  extension_universitaria: 'Extensión universitaria',
  interaccion_social: 'Interacción social',
  gestion: 'Gestión',
  academica_administrativa: 'Académica-administrativa',
  social_cultural_deportiva: 'Social, cultural, deportiva y Otros',
};

const nuevaAsignatura = () => ({
  materia: '',
  nombre: '',
  sigla: '',
  paralelo: '',
  horas_aula: '',
  inscritos: '',
  aprobados: '',
  reprobados: '',
  habilitados: '',
  descripcion_evaluacion: '',
});

const nuevaEvidencia = () => ({
  categoria: 'investigacion',
  actividad: '',
  descripcion_ejecutado: '',
  archivo: null,
});

function FormularioPresentarInforme({ fondoId, fondo, onInformePresentado, onCancelar }) {
  const cargasAcademicas = useMemo(() => {
    const categoria = fondo?.categorias?.find((cat) => cat.tipo === 'academica');
    return categoria?.detalles_carga || [];
  }, [fondo]);

  const asignaturasIniciales = useMemo(() => {
    const filas = cargasAcademicas.map((carga) => ({
      ...nuevaAsignatura(),
      materia: carga.materia || carga.materia_id || '',
      nombre: carga.titulo_actividad || '',
      paralelo: carga.paralelo || '',
      horas_aula: carga.horas || '',
    }));
    return filas.length ? filas : [nuevaAsignatura()];
  }, [cargasAcademicas]);

  const categoriasNoAcademicas = useMemo(
    () => (fondo?.categorias || []).filter((cat) => cat.tipo !== 'academica'),
    [fondo],
  );

  const [loading, setLoading] = useState(false);
  const [actividadesRealizadas, setActividadesRealizadas] = useState('');
  const [logros, setLogros] = useState('');
  const [dificultades, setDificultades] = useState('');
  const [resultados, setResultados] = useState('');
  const [asignaturas, setAsignaturas] = useState(asignaturasIniciales);
  const [evidencias, setEvidencias] = useState([nuevaEvidencia()]);

  const horasAulaEjecutadas = asignaturas.reduce(
    (total, item) => total + Number(item.horas_aula || 0),
    0,
  );

  const actualizarAsignatura = (index, campo, valor) => {
    setAsignaturas((prev) => prev.map((item, idx) => (
      idx === index ? { ...item, [campo]: valor } : item
    )));
  };

  const actualizarEvidencia = (index, campo, valor) => {
    setEvidencias((prev) => prev.map((item, idx) => (
      idx === index ? { ...item, [campo]: valor } : item
    )));
  };

  const validar = () => {
    if (actividadesRealizadas.trim().length < 50) {
      toast.error('Describe las actividades ejecutadas con al menos 50 caracteres.');
      return false;
    }
    if (logros.trim().length < 30) {
      toast.error('Describe los logros alcanzados con al menos 30 caracteres.');
      return false;
    }
    const asignaturasValidas = asignaturas.filter((item) => (
      (item.materia || item.nombre.trim()) && Number(item.horas_aula || 0) >= 0
    ));
    if (!asignaturasValidas.length) {
      toast.error('Registra al menos una asignatura ejecutada.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validar()) return;

    const payload = new FormData();
    payload.append('actividades_realizadas', actividadesRealizadas);
    payload.append('logros', logros);
    payload.append('dificultades', dificultades);
    payload.append('resultados', resultados);
    payload.append('resumen_ejecutivo', actividadesRealizadas.slice(0, 500));
    payload.append('asignaturas_ejecutadas', JSON.stringify(asignaturas));

    const evidenciasJson = evidencias
      .filter((item) => item.descripcion_ejecutado.trim() || item.archivo)
      .map((item, idx) => {
        if (item.archivo) payload.append(`evidencia_archivo_${idx}`, item.archivo);
        return {
          categoria: item.categoria,
          actividad: item.actividad || null,
          descripcion_ejecutado: item.descripcion_ejecutado,
        };
      });
    payload.append('evidencias_digitales', JSON.stringify(evidenciasJson));

    setLoading(true);
    try {
      await api.post(`/fondos-tiempo/${fondoId}/presentar-informe/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Informe final presentado exitosamente');
      onInformePresentado();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al presentar el informe'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100000] p-3"
      style={{ left: 'var(--fondo-sidebar-width, 18rem)' }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="bg-slate-900 px-5 py-3">
          <h2 className="text-xl font-bold text-white">Informe Final de Cumplimiento</h2>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Sección Académica</h3>
              <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Horas Aula Ejecutadas: {horasAulaEjecutadas.toFixed(2)}
              </div>
            </div>

            <div className="space-y-3">
              {asignaturas.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border border-slate-300 dark:border-slate-600 p-3">
                  <input className="md:col-span-3 input-fondo" placeholder="Asignatura" value={item.nombre} onChange={(e) => actualizarAsignatura(index, 'nombre', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" placeholder="Sigla" value={item.sigla} onChange={(e) => actualizarAsignatura(index, 'sigla', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" placeholder="Par." value={item.paralelo} onChange={(e) => actualizarAsignatura(index, 'paralelo', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" type="number" min="0" step="0.01" placeholder="Horas" value={item.horas_aula} onChange={(e) => actualizarAsignatura(index, 'horas_aula', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" type="number" min="0" placeholder="Inscr." value={item.inscritos} onChange={(e) => actualizarAsignatura(index, 'inscritos', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" type="number" min="0" placeholder="Aprob." value={item.aprobados} onChange={(e) => actualizarAsignatura(index, 'aprobados', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" type="number" min="0" placeholder="Reprob." value={item.reprobados} onChange={(e) => actualizarAsignatura(index, 'reprobados', e.target.value)} />
                  <input className="md:col-span-1 input-fondo" type="number" min="0" placeholder="Habil." value={item.habilitados} onChange={(e) => actualizarAsignatura(index, 'habilitados', e.target.value)} />
                  <button type="button" className="md:col-span-1 px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200" onClick={() => setAsignaturas((prev) => prev.filter((_, idx) => idx !== index))}>Quitar</button>
                  <textarea className="md:col-span-12 input-fondo min-h-20" placeholder="Descripción de la evaluación" value={item.descripcion_evaluacion} onChange={(e) => actualizarAsignatura(index, 'descripcion_evaluacion', e.target.value)} />
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 px-4 py-2 rounded-md bg-blue-600 text-white font-semibold" onClick={() => setAsignaturas((prev) => [...prev, nuevaAsignatura()])}>
              Agregar asignatura
            </button>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea className="input-fondo min-h-28" placeholder="Descripción general de lo ejecutado" value={actividadesRealizadas} onChange={(e) => setActividadesRealizadas(e.target.value)} />
            <textarea className="input-fondo min-h-28" placeholder="Logros alcanzados" value={logros} onChange={(e) => setLogros(e.target.value)} />
            <textarea className="input-fondo min-h-24" placeholder="Resultados obtenidos" value={resultados} onChange={(e) => setResultados(e.target.value)} />
            <textarea className="input-fondo min-h-24" placeholder="Dificultades encontradas" value={dificultades} onChange={(e) => setDificultades(e.target.value)} />
          </section>

          <section>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Otras Categorías y Evidencias</h3>
            <div className="space-y-3">
              {evidencias.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border border-slate-300 dark:border-slate-600 p-3">
                  <select className="md:col-span-3 input-fondo" value={item.categoria} onChange={(e) => actualizarEvidencia(index, 'categoria', e.target.value)}>
                    {categoriasNoAcademicas.map((cat) => (
                      <option key={cat.tipo} value={cat.tipo}>{CATEGORIA_LABELS[cat.tipo] || cat.tipo_display}</option>
                    ))}
                  </select>
                  <textarea className="md:col-span-5 input-fondo min-h-20" placeholder="Descripción de lo ejecutado" value={item.descripcion_ejecutado} onChange={(e) => actualizarEvidencia(index, 'descripcion_ejecutado', e.target.value)} />
                  <input className="md:col-span-3 input-fondo" type="file" onChange={(e) => actualizarEvidencia(index, 'archivo', e.target.files?.[0] || null)} />
                  <button type="button" className="md:col-span-1 px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200" onClick={() => setEvidencias((prev) => prev.filter((_, idx) => idx !== index))}>Quitar</button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 px-4 py-2 rounded-md bg-blue-600 text-white font-semibold" onClick={() => setEvidencias((prev) => [...prev, nuevaEvidencia()])}>
              Agregar evidencia
            </button>
          </section>
        </form>

        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900 flex gap-3">
          <button type="button" onClick={onCancelar} disabled={loading} className="flex-1 px-5 py-3 rounded-md font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="flex-1 px-5 py-3 rounded-md font-bold bg-blue-700 text-white disabled:opacity-60">
            {loading ? 'Enviando...' : 'Presentar Informe Final'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FormularioPresentarInforme;
