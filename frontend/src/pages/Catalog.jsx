import { useState, useEffect, useRef } from 'react';
import { addToCart } from '../api/cart';

const LEVELS = [
  { key: 'primaria', label: 'Primaria', icon: '🌱' },
  { key: 'secundaria', label: 'Secundaria', icon: '📚' },
];

function getLevelFromCourse(name) {
  if (name.startsWith('Primaria')) return 'primaria';
  if (name.startsWith('Secundaria')) return 'secundaria';
  return 'other';
}

export default function Catalog({ onCartUpdate }) {
  const [courses, setCourses] = useState([]);
  const [allBooklets, setAllBooklets] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  // Refs for matching booklets to courses by name
  const courseIdToName = useRef({});
  const courseNameToIds = useRef({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesRes, bookletsRes] = await Promise.all([
        fetch('/api/catalog/courses'),
        fetch('/api/catalog/booklets?per_page=500'),
      ]);
      const coursesData = await coursesRes.json();
      const bookletsData = await bookletsRes.json();

      const raw = coursesData.data || [];
      // Build maps for robust matching
      const idToName = {};
      const nameToIds = {};
      for (const c of raw) {
        const key = c.name.trim().toLowerCase();
        idToName[c.id] = key;
        if (!nameToIds[key]) nameToIds[key] = new Set();
        nameToIds[key].add(c.id);
      }
      courseIdToName.current = idToName;
      courseNameToIds.current = nameToIds;

      // Deduplicate by normalized name, keep first occurrence (for display)
      const seen = new Set();
      const unique = raw.filter(c => {
        const key = c.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setCourses(unique);
      setAllBooklets(bookletsData.data || []);
      console.log('Loaded', unique.length, 'courses,', (bookletsData.data || []).length, 'booklets');
    } catch {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredBooklets = selectedCourse
    ? allBooklets.filter(b => {
        // Direct ID match
        if (b.course_id === selectedCourse.id) return true;
        // Match by course name: find the name of the booklet's course_id,
        // then check if it matches the selected course's name
        const bookletCourseName = courseIdToName.current[b.course_id];
        if (!bookletCourseName) return false;
        const selectedKey = selectedCourse.name.trim().toLowerCase();
        return bookletCourseName === selectedKey;
      })
    : [];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async (booklet) => {
    setToast(null);
    try {
      await addToCart({ booklet_id: booklet.id, quantity: 1 });
      setToast({ type: 'success', message: `"${booklet.title}" agregado al carrito` });
      onCartUpdate?.();
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast({ type: 'error', message: 'Error al agregar al carrito' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
  };

  const handleBack = () => {
    setSelectedCourse(null);
  };

  const formatPrice = (cents) => `$${(cents / 100).toLocaleString('es-AR')}`;

  // Extract division names from description
  const getDivisionsFromDesc = (desc) => {
    if (!desc) return '';
    const match = desc.match(/Divisiones:\s*(.+)/);
    return match ? match[1].replace(/\s*\(.*\)/, '') : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-surface-500 text-sm">Cargando cursos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ring-1 transition-all duration-300 ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-800 ring-green-200'
            : 'bg-red-50 text-red-800 ring-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l2 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Course detail view */}
      {selectedCourse ? (
        <>
          {/* Breadcrumb */}
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-surface-500 hover:text-primary-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a cursos
            </button>
            <h1 className="text-2xl font-bold text-surface-900 mt-2">{selectedCourse.name}</h1>
            {selectedCourse.description && (
              <p className="mt-1 text-surface-500">{selectedCourse.description}</p>
            )}
          </div>

          {/* Booklets */}
          {filteredBooklets.length === 0 ? (
            <div className="text-center py-12 text-surface-500">
              <svg className="w-12 h-12 text-surface-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>No hay cuadernillos para <span className="font-medium">{selectedCourse.name}</span> aún.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-200 bg-surface-50">
                <h2 className="text-lg font-semibold text-surface-900">
                  Cuadernillos disponibles — {selectedCourse.name}
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-surface-600">Título</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600">Divisiones</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600">Precio</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredBooklets.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-50">
                      <td className="px-5 py-3 font-medium text-surface-900">{b.title}</td>
                      <td className="px-5 py-3">
                        {getDivisionsFromDesc(b.description) ? (
                          <span className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md font-medium">
                            {getDivisionsFromDesc(b.description)}
                          </span>
                        ) : (
                          <span className="text-surface-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-primary-600">{formatPrice(b.current_price)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleAdd(b)}
                          className="btn-primary inline-flex items-center gap-1.5 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Course list view - grouped by level */
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-surface-900">Cursos disponibles</h1>
            <p className="mt-1 text-surface-500">Seleccioná tu curso para ver los cuadernillos.</p>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-lg font-medium text-surface-900">No hay cursos disponibles</h3>
              <p className="mt-1 text-surface-500">Aún no se cargaron cursos.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {LEVELS.map((level) => {
                const levelCourses = courses.filter(c => getLevelFromCourse(c.name) === level.key);
                if (levelCourses.length === 0) return null;

                const isPrimaria = level.key === 'primaria';

                return (
                  <div
                    key={level.key}
                    className={`rounded-2xl overflow-hidden ring-1 transition-shadow hover:shadow-lg ${
                      isPrimaria
                        ? 'ring-emerald-200 bg-emerald-50/40'
                        : 'ring-violet-200 bg-violet-50/40'
                    }`}
                  >
                    {/* Level header */}
                    <div className={`px-6 py-4 flex items-center gap-3 ${
                      isPrimaria ? 'bg-emerald-100' : 'bg-violet-100'
                    }`}>
                      <span className="text-2xl">{level.icon}</span>
                      <h2 className="text-xl font-bold text-surface-900">{level.label}</h2>
                      <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                        isPrimaria ? 'bg-emerald-200 text-emerald-800' : 'bg-violet-200 text-violet-800'
                      }`}>
                        {levelCourses.length} {levelCourses.length === 1 ? 'curso' : 'cursos'}
                      </span>
                    </div>

                    {/* Course cards inside level card */}
                    <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {levelCourses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => handleSelectCourse(course)}
                          className="card overflow-hidden hover:shadow-lg transition-all duration-200 text-left group cursor-pointer ring-1 ring-white/80 hover:ring-primary-300 bg-white"
                        >
                          <div className={`h-28 flex items-center justify-center transition-all ${
                            isPrimaria
                              ? 'bg-gradient-to-br from-emerald-200 to-emerald-100 group-hover:from-emerald-300 group-hover:to-emerald-200'
                              : 'bg-gradient-to-br from-violet-200 to-violet-100 group-hover:from-violet-300 group-hover:to-violet-200'
                          }`}>
                            <svg className={`w-12 h-12 group-hover:scale-110 transition-transform ${
                              isPrimaria ? 'text-emerald-500' : 'text-violet-500'
                            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>

                          <div className="p-4">
                            <h3 className="font-semibold text-surface-900 group-hover:text-primary-700 transition-colors">{course.name}</h3>
                            {course.description && (
                              <p className="mt-1 text-sm text-surface-500 line-clamp-2">{course.description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
