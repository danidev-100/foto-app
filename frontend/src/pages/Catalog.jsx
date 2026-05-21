import { useState, useEffect } from 'react';
import { addToCart } from '../api/cart';
import api from '../api/client';

const LEVELS = [
  { key: 'primaria', label: 'Primaria', icon: '🌱' },
  { key: 'secundaria', label: 'Secundaria', icon: '📚' },
];

const LEVEL_ACCENTS = {
  primaria: {
    light: 'from-emerald-50 to-primary-50',
    gradient: 'from-emerald-400 to-primary-500',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    hover: 'hover:ring-emerald-200',
    accent: 'bg-emerald-500',
  },
  secundaria: {
    light: 'from-sky-50 to-primary-50',
    gradient: 'from-sky-400 to-primary-500',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    hover: 'hover:ring-sky-200',
    accent: 'bg-sky-500',
  },
};

function getLevelFromCourse(name) {
  if (name.startsWith('Primaria')) return 'primaria';
  if (name.startsWith('Secundaria')) return 'secundaria';
  return 'other';
}

export default function Catalog({ onCartUpdate }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [booklets, setBooklets] = useState([]);
  const [loadingBooklets, setLoadingBooklets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/catalog/courses');
      const raw = response.data.data || [];
      const uniqueCourses = [...new Map(raw.map(c => [c.id, c])).values()];
      setCourses(uniqueCourses);
    } catch {
      showToast('Error al cargar cursos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCourseBooklets = async (courseId) => {
    console.log('Loading booklets for course:', courseId);
    setLoadingBooklets(true);
    try {
      const response = await api.get(`/catalog/booklets?course_id=${courseId}&per_page=100`);
      console.log('Response data:', response.data);
      setBooklets(response.data.data || []);
    } catch (error) {
      console.error('Error loading booklets:', error);
      showToast('Error al cargar cuadernillos', 'error');
      setBooklets([]);
    } finally {
      setLoadingBooklets(false);
    }
  };

  const handleSelectCourse = async (course) => {
    console.log('Selecting course:', course);
    setSelectedCourse(course);
    await loadCourseBooklets(course.id);
  };

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

  const handleBack = () => {
    setSelectedCourse(null);
    setBooklets([]);
  };

  const toNum = (val) => (val === null || val === undefined ? 0 : Number(val));
  const formatPrice = (cents) => `$${(toNum(cents) / 100).toLocaleString('es-AR')}`;

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
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ring-1 transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-red-50 text-red-800 ring-red-200'
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

      {selectedCourse ? (
        <>
          {/* Header con botón volver */}
          <div className="mb-8">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a cursos
            </button>
            <h1 className="text-2xl font-bold text-surface-900 mt-3">{selectedCourse.name}</h1>
            {selectedCourse.description && (
              <p className="mt-1 text-surface-500">{selectedCourse.description}</p>
            )}
          </div>

          {/* Cuadernillos */}
          {loadingBooklets ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              <span className="ml-3 text-surface-500">Cargando cuadernillos...</span>
            </div>
          ) : booklets.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm ring-1 ring-surface-200/60">
              <svg className="w-14 h-14 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-surface-500 font-medium">No hay cuadernillos disponibles para este curso.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {booklets.map((b) => {
                const divisions = getDivisionsFromDesc(b.description);
                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl shadow-sm ring-1 ring-surface-200/60 hover:shadow-md hover:ring-primary-200 transition-all duration-200"
                  >
                    <div className="p-5 flex items-center gap-4">
                      {/* Icon */}
                      <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary-50 items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-surface-900">{b.title}</h3>
                            {divisions && (
                              <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-md bg-primary-50 text-primary-700 ring-1 ring-primary-200">
                                Div. {divisions}
                              </span>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-primary-600">{formatPrice(b.currentPrice)}</p>
                          </div>
                        </div>
                        {b.description && (
                          <p className="mt-1.5 text-sm text-surface-500 line-clamp-2">{b.description}</p>
                        )}
                      </div>

                      {/* Acción */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleAdd(b)}
                          className="btn-primary inline-flex items-center gap-1.5 text-sm whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-surface-900">Cursos disponibles</h1>
            <p className="mt-2 text-surface-500">Elegí un curso para ver sus cuadernillos.</p>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm ring-1 ring-surface-200/60">
              <svg className="w-16 h-16 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-lg font-semibold text-surface-900">No hay cursos disponibles</h3>
              <p className="mt-1 text-surface-500">Aún no se cargaron cursos.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {LEVELS.map((level) => {
                const levelCourses = courses.filter(c => getLevelFromCourse(c.name) === level.key);
                if (levelCourses.length === 0) return null;

                const accent = LEVEL_ACCENTS[level.key];

                return (
                  <section key={level.key}>
                    {/* Level header */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${accent.iconBg} ${accent.iconColor}`}>
                        <span className="text-xl">{level.icon}</span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-surface-900">{level.label}</h2>
                        <p className="text-sm text-surface-500">
                          {levelCourses.length} {levelCourses.length === 1 ? 'curso disponible' : 'cursos disponibles'}
                        </p>
                      </div>
                    </div>

                    {/* Courses grid */}
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {levelCourses.map((course) => (
                        <div
                          key={course.id}
                          role="button"
                          tabIndex={0}
                          className={`relative bg-white rounded-2xl shadow-sm ring-1 ring-surface-200/60 cursor-pointer hover:shadow-lg ${accent.hover} transition-all duration-200 select-none overflow-hidden group`}
                          onClick={() => handleSelectCourse(course)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectCourse(course);
                            }
                          }}
                        >
                          {/* Top accent bar */}
                          <div className={`h-2 bg-gradient-to-r ${accent.gradient}`} />

                          <div className="p-5">
                            <div className="flex items-start gap-4">
                              {/* Icon */}
                              <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${accent.iconBg} ${accent.iconColor} flex items-center justify-center`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-surface-900 truncate">{course.name}</h3>
                                <p className="mt-1.5 text-sm text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  Ver cuadernillos →
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
