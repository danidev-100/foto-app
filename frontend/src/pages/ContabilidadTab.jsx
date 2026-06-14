import { useState, useEffect } from 'react';
import {
  adminGetProgressSummary,
  adminGetBookletProgress,
  adminUpdateProgress,
  adminSetPrintedQuantity,
  adminExportProgress,
} from '../api/admin';
import { useToast } from '../components/ToastProvider';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';

export default function ContabilidadTab() {
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('progreso');
  const [progressSummary, setProgressSummary] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedBooklet, setSelectedBooklet] = useState(null);
  const [bookletDetail, setBookletDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [editingPrinted, setEditingPrinted] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const loadData = async (schoolId) => {
    setLoading(true);
    try {
      const res = await adminGetProgressSummary(schoolId || undefined);
      setProgressSummary(res.data.data || []);
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSchoolChange = (schoolId) => {
    setSelectedSchoolId(schoolId);
    setSelectedBooklet(null);
    setBookletDetail(null);
    loadData(schoolId);
  };

  const handleRowClick = async (bookletId) => {
    setSelectedBooklet(bookletId);
    setDetailLoading(true);
    setBookletDetail(null);
    try {
      const res = await adminGetBookletProgress(bookletId);
      setBookletDetail(res.data.data || null);
    } catch {
      toast.error('Error al cargar detalle del cuadernillo');
      setSelectedBooklet(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedBooklet(null);
    setBookletDetail(null);
  };

  const handleToggle = async (student) => {
    const newStatus = student.status === 'completed' ? 'pending' : 'completed';

    setBookletDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) =>
          s.progress_id === student.progress_id ? { ...s, status: newStatus } : s
        ),
      };
    });

    setTogglingIds((prev) => new Set(prev).add(student.progress_id));

    try {
      await adminUpdateProgress(student.progress_id, newStatus);
    } catch {
      setBookletDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          students: prev.students.map((s) =>
            s.progress_id === student.progress_id ? { ...s, status: student.status } : s
          ),
        };
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(student.progress_id);
        return next;
      });
    }
  };

  const handleStartEdit = (booklet) => {
    setEditingPrinted(booklet.booklet_id);
    setEditValue(String(booklet.printed_quantity));
  };

  const handleSavePrinted = async (bookletId) => {
    const qty = parseInt(editValue, 10);
    if (isNaN(qty) || qty < 0) return;

    setSavingId(bookletId);
    try {
      await adminSetPrintedQuantity(bookletId, qty);
      setProgressSummary((prev) =>
        prev.map((b) =>
          b.booklet_id === bookletId
            ? { ...b, printed_quantity: qty, faltantes: Math.max(0, b.active_orders - qty) }
            : b
        )
      );
    } catch {
      toast.error('Error al guardar cantidad impresa');
    } finally {
      setSavingId(null);
      setEditingPrinted(null);
    }
  };

  const handleDownloadCSV = async () => {
    setCsvLoading(true);
    try {
      const res = await adminExportProgress();
      const blob = new Blob([res.data], { type: 'text/csv; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'progress-export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('CSV descargado');
    } catch {
      toast.error('Error al descargar CSV');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleKeyDown = (e, bookletId) => {
    if (e.key === 'Enter') handleSavePrinted(bookletId);
    if (e.key === 'Escape') setEditingPrinted(null);
  };

  // Derive schools list from summary data
  const schools = [...new Map(
    progressSummary.map((b) => [b.school_name, { name: b.school_name }])
  ).values()];

  const filteredSummary = selectedSchoolId
    ? progressSummary.filter((b) => b.school_name === schools.find((s) => s.name === selectedSchoolId)?.name)
    : progressSummary;

  // ── Loading State ──
  if (loading) {
    return <Loading variant="spinner" className="py-20" />;
  }


  // ── Detail View (Progreso) ──
  if (selectedBooklet && activeTab === 'progreso') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
        </div>

        {bookletDetail ? (
          <>
            <div className="card p-5">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                {bookletDetail.booklet_title}
              </h3>
              <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                {bookletDetail.students.filter((s) => s.status === 'completed').length} de{' '}
                {bookletDetail.students.length} estudiantes completaron
              </p>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="hidden md:table-header-group bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Nombre</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {bookletDetail.students.map((s) => (
                    <tr key={s.progress_id} className="flex flex-col md:table-row border-b md:border-b-0 border-surface-100 dark:border-surface-700 last:border-b-0 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                      <td className="flex items-center justify-between md:table-cell px-5 py-3 font-medium text-surface-900 dark:text-surface-100">
                        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Nombre</span>
                        <span className="text-right md:text-left">{s.student_name}</span>
                      </td>
                      <td className="flex items-center justify-between md:table-cell px-5 py-3">
                        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Estado</span>
                        <span>
                          <Badge variant={s.status === 'completed' ? 'success' : 'warning'} size="sm">
                            {s.status === 'completed' ? 'Listo' : 'Pendiente'}
                          </Badge>
                        </span>
                      </td>
                      <td className="flex items-center justify-between md:table-cell px-5 py-3">
                        <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Acción</span>
                        <button
                          onClick={() => handleToggle(s)}
                          disabled={togglingIds.has(s.progress_id)}
                          className={`text-sm font-medium transition-colors min-h-[44px] inline-flex items-center ${
                            togglingIds.has(s.progress_id)
                              ? 'text-surface-400 cursor-not-allowed'
                              : 'text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300'
                          }`}
                        >
                          {togglingIds.has(s.progress_id)
                            ? 'Actualizando...'
                            : s.status === 'completed'
                              ? 'Marcar como pendiente'
                              : 'Marcar como listo'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Loading variant="spinner" className="py-12" />
        )}
      </div>
    );
  }

  // ── Main View ──
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Contabilidad</h2>

      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto flex-nowrap">
        <button
          onClick={() => { setActiveTab('progreso'); setSelectedBooklet(null); }}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'progreso'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
        >
          Progreso
        </button>
        <button
          onClick={() => { setActiveTab('produccion'); setSelectedBooklet(null); }}
          className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'produccion'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
        >
          Producción
        </button>
      </div>

      {/* School selector */}
      <div className="card p-5">
        <label className="label-field">Colegio</label>
        <select
          value={selectedSchoolId}
          onChange={(e) => handleSchoolChange(e.target.value)}
          className="input-field mt-1.5"
        >
          <option value="">Todos los colegios</option>
          {progressSummary
            .filter((b, i, arr) => arr.findIndex((x) => x.school_name === b.school_name) === i)
            .map((b) => (
              <option key={b.school_name} value={b.school_name}>
                {b.school_name}
              </option>
            ))}
        </select>
      </div>

      {/* ── Tab: Progreso ── */}
      {activeTab === 'progreso' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cuadernillo</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Curso</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Progreso</th>
                <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {filteredSummary.map((b) => (
                <tr
                  key={b.booklet_id}
                  onClick={() => handleRowClick(b.booklet_id)}
                  className="flex flex-col md:table-row border-b md:border-b-0 border-surface-100 dark:border-surface-700 last:border-b-0 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer"
                >
                  <td className="flex items-center justify-between md:table-cell px-5 py-3 font-medium text-surface-900 dark:text-surface-100">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Cuadernillo</span>
                    <span className="text-right md:text-left">{b.booklet_title}</span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3 text-surface-500 dark:text-surface-400">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Curso</span>
                    <span className="text-right md:text-left">{b.course_name}</span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Progreso</span>
                    <span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              b.percentage === 100
                                ? 'bg-green-500'
                                : b.percentage > 50
                                  ? 'bg-primary-500'
                                  : 'bg-amber-500'
                            }`}
                            style={{ width: `${b.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
                          {b.completed}/{b.total_students}
                        </span>
                        <span className="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap">
                          {b.percentage}%
                        </span>
                      </div>
                    </span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Pendientes</span>
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{b.pending}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSummary.length === 0 && (
            <EmptyState message="No hay cuadernillos" />
          )}
        </div>
      )}

      {/* ── Tab: Producción ── */}
      {activeTab === 'produccion' && (
        <>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-surface-500 dark:text-surface-400">
            Seguimiento de producción por cuadernillo.
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={csvLoading}
            className="btn-secondary text-sm inline-flex items-center gap-2 min-h-[44px]"
          >
            {csvLoading ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar CSV
              </>
            )}
          </button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cuadernillo</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Curso</th>
                <th className="text-center px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Impresos</th>
                <th className="text-center px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pedidos</th>
                <th className="text-center px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Faltantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {filteredSummary.map((b) => (
                <tr key={b.booklet_id} className="flex flex-col md:table-row border-b md:border-b-0 border-surface-100 dark:border-surface-700 last:border-b-0 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <td className="flex items-center justify-between md:table-cell px-5 py-3 font-medium text-surface-900 dark:text-surface-100">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Cuadernillo</span>
                    <span className="text-right md:text-left">{b.booklet_title}</span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3 text-surface-500 dark:text-surface-400">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Curso</span>
                    <span className="text-right md:text-left">{b.course_name}</span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Impresos</span>
                    <span>
                      {editingPrinted === b.booklet_id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, b.booklet_id)}
                            className="w-20 text-center input-field py-1 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSavePrinted(b.booklet_id)}
                            disabled={savingId === b.booklet_id}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            {savingId === b.booklet_id ? '...' : 'OK'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(b)}
                          className="text-surface-900 dark:text-surface-100 font-medium hover:text-primary-600 dark:hover:text-primary-400 min-h-[44px] inline-flex items-center"
                        >
                          {b.printed_quantity}
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Pedidos</span>
                    <span className="font-medium text-surface-900 dark:text-surface-100">{b.active_orders}</span>
                  </td>
                  <td className="flex items-center justify-between md:table-cell px-5 py-3">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider md:hidden">Faltantes</span>
                    <span>
                      {b.faltantes > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Faltan {b.faltantes}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 font-medium">Completo</span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSummary.length === 0 && (
            <EmptyState message="No hay cuadernillos" />
          )}
        </div>
      </>
      )}
    </div>
  );
}
