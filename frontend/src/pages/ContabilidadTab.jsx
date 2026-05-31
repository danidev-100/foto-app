import { useState, useEffect } from 'react';
import {
  adminGetProgressSummary,
  adminGetBookletProgress,
  adminUpdateProgress,
  adminSetPrintedQuantity,
} from '../api/admin';

function ProductionCard({ booklet, editingPrinted, editValue, savingId, onStartEdit, onSavePrinted, onEditValueChange, onKeyDown }) {
  return (
    <div className="card p-3 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
            {booklet.booklet_title}
          </h4>
          <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
            {booklet.course_name}
          </p>
          <p className="text-xs text-surface-400 dark:text-surface-500 truncate">
            {booklet.school_name}
          </p>
        </div>
        {booklet.faltantes > 0 ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800">
            -{booklet.faltantes}
          </span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800">
            OK
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-surface-400">Impresos:</span>
          {editingPrinted === booklet.booklet_id ? (
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                min="0"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={(e) => onKeyDown(e, booklet.booklet_id)}
                className="w-14 text-center input-field py-0.5 text-xs"
                autoFocus
              />
              <button
                onClick={() => onSavePrinted(booklet.booklet_id)}
                disabled={savingId === booklet.booklet_id}
                className="text-primary-600 hover:text-primary-700 font-medium px-1"
              >
                {savingId === booklet.booklet_id ? '...' : 'OK'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onStartEdit(booklet)}
              className="font-semibold text-surface-900 dark:text-surface-100 hover:text-primary-600 dark:hover:text-primary-400"
            >
              {booklet.printed_quantity}
            </button>
          )}
        </div>
        <span className="text-surface-300">|</span>
        <div className="flex items-center gap-1">
          <span className="text-surface-400">Pedidos:</span>
          <span className="font-semibold text-surface-900 dark:text-surface-100">{booklet.active_orders}</span>
        </div>
      </div>
    </div>
  );
}

export default function ContabilidadTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const loadData = async (schoolId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetProgressSummary(schoolId || undefined);
      setProgressSummary(res.data.data || []);
    } catch {
      setError('Error al cargar datos');
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
      setError('Error al cargar detalle del cuadernillo');
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
      setError('Error al guardar cantidad impresa');
    } finally {
      setSavingId(null);
      setEditingPrinted(null);
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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error Toast ──
  if (error) {
    return (
      <div className="fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ring-1 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-800">
        <span className="text-sm font-medium">{error}</span>
      </div>
    );
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

            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Nombre</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {bookletDetail.students.map((s) => (
                    <tr key={s.progress_id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                      <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">{s.student_name}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`badge ${
                            s.status === 'completed'
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800'
                              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800'
                          }`}
                        >
                          {s.status === 'completed' ? 'Listo' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleToggle(s)}
                          disabled={togglingIds.has(s.progress_id)}
                          className={`text-sm font-medium transition-colors ${
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
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // ── Main View ──
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Contabilidad</h2>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setActiveTab('progreso'); setSelectedBooklet(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'progreso'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
        >
          Progreso
        </button>
        <button
          onClick={() => { setActiveTab('produccion'); setSelectedBooklet(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
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
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer"
                >
                  <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">{b.booklet_title}</td>
                  <td className="px-5 py-3 text-surface-500 dark:text-surface-400">{b.course_name}</td>
                  <td className="px-5 py-3">
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
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{b.pending}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSummary.length === 0 && (
            <div className="text-center py-8 text-surface-500 dark:text-surface-400">No hay cuadernillos</div>
          )}
        </div>
      )}

      {/* ── Tab: Producción (Kanban) ── */}
      {activeTab === 'produccion' && (
        <div className="space-y-6">
          {(() => {
            const porImprimir = filteredSummary.filter((b) => b.faltantes > 0 && b.printed_quantity === 0);
            const enImpresion = filteredSummary.filter((b) => b.printed_quantity > 0 && b.faltantes > 0);
            const completado = filteredSummary.filter((b) => b.faltantes === 0);

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Columna: Por imprimir */}
                <div className="card overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Por imprimir</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400">
                        {porImprimir.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-3 space-y-3 min-h-[200px]">
                    {porImprimir.map((b) => (
                      <ProductionCard
                        key={b.booklet_id}
                        booklet={b}
                        editingPrinted={editingPrinted}
                        editValue={editValue}
                        savingId={savingId}
                        onStartEdit={handleStartEdit}
                        onSavePrinted={handleSavePrinted}
                        onEditValueChange={setEditValue}
                        onKeyDown={handleKeyDown}
                      />
                    ))}
                    {porImprimir.length === 0 && (
                      <p className="text-xs text-surface-400 text-center py-8">Sin cuadernillos</p>
                    )}
                  </div>
                </div>

                {/* Columna: En impresión */}
                <div className="card overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-amber-50 dark:bg-amber-900/20">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">En impresión</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                        {enImpresion.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-3 space-y-3 min-h-[200px]">
                    {enImpresion.map((b) => (
                      <ProductionCard
                        key={b.booklet_id}
                        booklet={b}
                        editingPrinted={editingPrinted}
                        editValue={editValue}
                        savingId={savingId}
                        onStartEdit={handleStartEdit}
                        onSavePrinted={handleSavePrinted}
                        onEditValueChange={setEditValue}
                        onKeyDown={handleKeyDown}
                      />
                    ))}
                    {enImpresion.length === 0 && (
                      <p className="text-xs text-surface-400 text-center py-8">Sin cuadernillos</p>
                    )}
                  </div>
                </div>

                {/* Columna: Completado */}
                <div className="card overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">Completado</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                        {completado.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-3 space-y-3 min-h-[200px]">
                    {completado.map((b) => (
                      <ProductionCard
                        key={b.booklet_id}
                        booklet={b}
                        editingPrinted={editingPrinted}
                        editValue={editValue}
                        savingId={savingId}
                        onStartEdit={handleStartEdit}
                        onSavePrinted={handleSavePrinted}
                        onEditValueChange={setEditValue}
                        onKeyDown={handleKeyDown}
                      />
                    ))}
                    {completado.length === 0 && (
                      <p className="text-xs text-surface-400 text-center py-8">Sin cuadernillos</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
