import { useState, useEffect } from 'react';
import {
  adminGetProgressSummary,
  adminGetBookletProgress,
  adminUpdateProgress,
  adminGetSchools,
} from '../api/admin';

export default function ContabilidadTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [progressSummary, setProgressSummary] = useState([]);
  const [selectedBooklet, setSelectedBooklet] = useState(null);
  const [bookletDetail, setBookletDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [togglingIds, setTogglingIds] = useState(new Set());

  const loadData = async (schoolId) => {
    setLoading(true);
    setError(null);
    try {
      const [schoolsRes, progressRes] = await Promise.all([
        adminGetSchools(),
        adminGetProgressSummary(schoolId || undefined),
      ]);
      setSchools(schoolsRes.data.data || []);
      setProgressSummary(progressRes.data.data || []);
    } catch {
      setError('Error al cargar datos de progreso');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSchoolChange = async (schoolId) => {
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

    // Optimistic update
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
      // Revert on error
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

  // Filter summary by selected school
  const filteredSummary = selectedSchoolId
    ? progressSummary.filter((b) => b.school_name === schools.find((s) => s.id === selectedSchoolId)?.name)
    : progressSummary;

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ring-1 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-800">
        <span className="text-sm font-medium">{error}</span>
      </div>
    );
  }

  // ── Detail View ──
  if (selectedBooklet) {
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
                      <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">
                        {s.student_name}
                      </td>
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

  // ── Summary View (default) ──
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Contabilidad</h2>

      {/* School selector */}
      <div className="card p-5">
        <label className="label-field">Colegio</label>
        <select
          value={selectedSchoolId}
          onChange={(e) => handleSchoolChange(e.target.value)}
          className="input-field mt-1.5"
        >
          <option value="">Todos los colegios</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Progress summary table */}
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
                <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">
                  {b.booklet_title}
                </td>
                <td className="px-5 py-3 text-surface-500 dark:text-surface-400">
                  {b.course_name}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {/* Progress bar */}
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
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    {b.pending}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSummary.length === 0 && (
          <div className="text-center py-8 text-surface-500 dark:text-surface-400">
            No hay cuadernillos
          </div>
        )}
      </div>
    </div>
  );
}
