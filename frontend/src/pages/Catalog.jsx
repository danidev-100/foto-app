import { useState, useEffect } from 'react';
import { addToCart } from '../api/cart';
import api from '../api/client';
import { useToast } from '../components/ToastProvider';
import EmptyState from '../components/EmptyState';
import Loading from '../components/Loading';

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

const SCHOOL_THEMES = {
  'Don Bosco': {
    gradient: 'from-blue-600 to-indigo-700',
    light: 'from-blue-50 to-indigo-50',
    border: 'ring-blue-200',
    icon: '🏫',
  },
  'Rodeo del Medio': {
    gradient: 'from-amber-600 to-orange-700',
    light: 'from-amber-50 to-orange-50',
    border: 'ring-amber-200',
    icon: '🎓',
  },
};

function getLevelFromCourse(name) {
  if (name.startsWith('Primaria')) return 'primaria';
  if (name.startsWith('Secundaria')) return 'secundaria';
  return 'other';
}

function getSchoolTheme(name) {
  if (name.includes('Don Bosco')) return SCHOOL_THEMES['Don Bosco'];
  if (name.includes('Rodeo')) return SCHOOL_THEMES['Rodeo del Medio'];
  return SCHOOL_THEMES['Don Bosco'];
}

export default function Catalog({ onCartUpdate }) {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [booklets, setBooklets] = useState([]);
  const [loadingBooklets, setLoadingBooklets] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/catalog/schools');
      setSchools(response.data.data || []);
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const loadCourseBooklets = async (courseId) => {
    setLoadingBooklets(true);
    try {
      const response = await api.get(`/catalog/booklets?course_id=${courseId}&per_page=100`);
      setBooklets(response.data.data || []);
    } catch {
      toast.error('Error al cargar cuadernillos');
      setBooklets([]);
    } finally {
      setLoadingBooklets(false);
    }
  };

  const handleSelectSchool = (school) => {
    setSelectedSchool(school);
    setSelectedCourse(null);
    setBooklets([]);
  };

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    await loadCourseBooklets(course.id);
  };

  const handleBackToSchools = () => {
    setSelectedSchool(null);
    setSelectedCourse(null);
    setBooklets([]);
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setBooklets([]);
  };

  const handleAdd = async (booklet) => {
    try {
      await addToCart({ booklet_id: booklet.id, quantity: 1 });
      toast.success(`"${booklet.title}" agregado al carrito`);
      onCartUpdate?.();
    } catch {
      toast.error('Error al agregar al carrito');
    }
  };

  const toNum = (val) => (val === null || val === undefined ? 0 : Number(val));
  const formatPrice = (cents) => `$${(toNum(cents) / 100).toLocaleString('es-AR')}`;

  const getDivisionsFromDesc = (desc) => {
    if (!desc) return '';
    const match = desc.match(/Divisiones:\s*(.+)/);
    return match ? match[1].replace(/\s*\(.*\)/, '') : '';
  };

  if (loading) {
    return <Loading variant="spinner" className="py-20" />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {selectedCourse ? (
        <>
          <div className="mb-8">
            <button
              onClick={handleBackToCourses}
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

          {loadingBooklets ? (
            <Loading variant="spinner" className="py-12" />
          ) : booklets.length === 0 ? (
            <EmptyState message="No hay cuadernillos disponibles para este curso." />
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
                      <div className="hidden sm:flex w-12 h-12 rounded-xl bg-primary-50 items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>

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
      ) : selectedSchool ? (
        <>
          <div className="mb-8">
            <button
              onClick={handleBackToSchools}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a colegios
            </button>
            <h1 className="text-2xl font-bold text-surface-900 mt-3">{selectedSchool.name}</h1>
          </div>

          {selectedSchool.courses.length === 0 ? (
            <EmptyState
              message="No hay cursos disponibles"
              description="Aún no se cargaron cursos para este colegio."
            />
          ) : (
            <div className="space-y-12">
              {LEVELS.map((level) => {
                const levelCourses = selectedSchool.courses.filter(
                  (c) => getLevelFromCourse(c.name) === level.key
                );
                if (levelCourses.length === 0) return null;

                const accent = LEVEL_ACCENTS[level.key];

                return (
                  <section key={level.key}>
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

                    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                          <div className={`h-2 bg-gradient-to-r ${accent.gradient}`} />

                          <div className="p-5">
                            <div className="flex items-start gap-4">
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
      ) : (
        <>
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-surface-900">Colegios</h1>
            <p className="mt-2 text-surface-500">Elegí un colegio para ver sus cursos.</p>
          </div>

          {schools.length === 0 ? (
            <EmptyState
              message="No hay colegios disponibles"
              description="Aún no se cargaron colegios."
            />
          ) : (
            <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
              {schools.map((school) => {
                const theme = getSchoolTheme(school.name);
                return (
                  <div
                    key={school.id}
                    role="button"
                    tabIndex={0}
                    className={`relative bg-gradient-to-br ${theme.light} rounded-3xl shadow-md ring-1 ${theme.border} cursor-pointer hover:shadow-xl transition-all duration-300 select-none overflow-hidden group`}
                    onClick={() => handleSelectSchool(school)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSchool(school);
                      }
                    }}
                  >
                    <div className={`h-2 bg-gradient-to-r ${theme.gradient}`} />
                    <div className="p-8">
                      <div className="flex items-center gap-5">
                        <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-3xl">
                          {theme.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-2xl font-bold text-surface-900">{school.name}</h2>
                          <p className="mt-1.5 text-surface-600 font-medium">
                            {school.courses.length} {school.courses.length === 1 ? 'curso' : 'cursos'}
                          </p>
                        </div>
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center group-hover:translate-x-1 transition-transform">
                          <svg className="w-5 h-5 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {LEVELS.map((level) => {
                          const count = school.courses.filter(
                            (c) => getLevelFromCourse(c.name) === level.key
                          ).length;
                          if (count === 0) return null;
                          return (
                            <span
                              key={level.key}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                                level.key === 'primaria'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-sky-100 text-sky-700'
                              }`}
                            >
                              <span>{level.icon}</span>
                              {level.label} ({count})
                            </span>
                          );
                        })}
                      </div>
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
