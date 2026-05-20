import { useState, useEffect } from 'react';
import {
  adminGetCourses, adminGetDivisions,
  adminGetBooklets, adminCreateBooklet, adminUpdateBooklet, adminDeleteBooklet,
} from '../api/admin';

// Structured course data: level -> grades -> divisions
const COURSE_STRUCTURE = {
  primaria: {
    label: 'Primaria',
    grades: [
      { value: 'jardin', label: 'Jardín' },
      { value: 'primero', label: '1° Primero' },
      { value: 'segundo', label: '2° Segundo' },
      { value: 'tercero', label: '3° Tercero' },
      { value: 'cuarto', label: '4° Cuarto' },
      { value: 'quinto', label: '5° Quinto' },
      { value: 'sexto', label: '6° Sexto' },
      { value: 'septimo', label: '7° Séptimo' },
    ],
    divisions: ['A', 'B', 'C'],
  },
  secundaria: {
    label: 'Secundaria',
    grades: [
      { value: 'primero', label: '1° Primero' },
      { value: 'segundo', label: '2° Segundo' },
      { value: 'tercero', label: '3° Tercero' },
      { value: 'cuarto', label: '4° Cuarto' },
      { value: 'quinto', label: '5° Quinto' },
    ],
    getDivisions(grade) {
      if (grade === 'primero' || grade === 'segundo') return ['A', 'B', 'C', 'D', 'E'];
      return ['A', 'B', 'N', 'H'];
    },
  },
};

export default function Admin() {
  const [courses, setCourses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [booklets, setBooklets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Structured selector state
  const [selLevel, setSelLevel] = useState('');
  const [selGrade, setSelGrade] = useState('');
  const [selDivisions, setSelDivisions] = useState([]);

  const [bookletForm, setBookletForm] = useState({
    course_id: '', division_id: '', title: '', description: '', current_price: '', is_active: true,
  });

  const [editingBooklet, setEditingBooklet] = useState(null);
  const [errors, setErrors] = useState({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, dRes, bRes] = await Promise.all([
        adminGetCourses(),
        adminGetDivisions(),
        adminGetBooklets(),
      ]);
      setCourses(cRes.data.data || []);
      setDivisions(dRes.data.data || []);
      setBooklets(bRes.data.data || []);
    } catch {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // When level/grade change, reset division selection
  useEffect(() => {
    setSelDivisions([]);
  }, [selLevel, selGrade]);

  // When level/grade/divisions change, find matching course from DB
  const [matchedCourseId, setMatchedCourseId] = useState('');
  const [divisionMap, setDivisionMap] = useState({});

  useEffect(() => {
    if (!selLevel || !selGrade || selDivisions.length === 0) {
      setMatchedCourseId('');
      setDivisionMap({});
      return;
    }

    const levelData = COURSE_STRUCTURE[selLevel];
    const gradeData = levelData.grades.find(g => g.value === selGrade);
    const expectedCourseName = `${levelData.label} - ${gradeData.label}`;

    const matchedCourse = courses.find(c => c.name === expectedCourseName);
    if (!matchedCourse) {
      setMatchedCourseId('');
      setDivisionMap({});
      return;
    }

    setMatchedCourseId(matchedCourse.id);

    // Build map of division name -> division ID for selected divisions
    const map = {};
    for (const divName of selDivisions) {
      const matchedDiv = divisions.find(d => d.course_id === matchedCourse.id && d.name === divName);
      if (matchedDiv) {
        map[divName] = matchedDiv.id;
      } else {
        console.warn(`Division "${divName}" not found for course "${matchedCourse.name}" (id: ${matchedCourse.id})`);
      }
    }
    setDivisionMap(map);
    console.log('Matched course:', matchedCourse.name, matchedCourse.id, '-> divisionMap:', map);
  }, [selLevel, selGrade, selDivisions, courses, divisions]);

  const toggleDivision = (div) => {
    setSelDivisions(prev =>
      prev.includes(div) ? prev.filter(d => d !== div) : [...prev, div]
    );
  };

  // Parse existing booklet's course name back to level/grade
  const parseCourseName = (name) => {
    for (const [levelKey, levelData] of Object.entries(COURSE_STRUCTURE)) {
      if (name.startsWith(levelData.label + ' - ')) {
        const gradeLabel = name.replace(levelData.label + ' - ', '');
        const grade = levelData.grades.find(g => g.label === gradeLabel);
        if (grade) return { level: levelKey, grade: grade.value };
      }
    }
    return { level: '', grade: '' };
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!selLevel) newErrors.selLevel = 'Seleccioná un nivel';
    if (!selGrade) newErrors.selGrade = 'Seleccioná un grado/año';
    if (selDivisions.length === 0) newErrors.selDivisions = 'Seleccioná al menos una división';
    if (!matchedCourseId) newErrors.matchedCourse = 'El curso no existe en la base de datos';

    if (!bookletForm.title.trim()) newErrors.title = 'El título es obligatorio';
    else if (bookletForm.title.trim().length < 3) newErrors.title = 'El título debe tener al menos 3 caracteres';

    if (!bookletForm.current_price) newErrors.current_price = 'El precio es obligatorio';
    else if (parseFloat(bookletForm.current_price) <= 0) newErrors.current_price = 'El precio debe ser mayor a 0';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Booklet CRUD
  const handleSaveBooklet = async () => {
    if (!validateForm()) return;

    if (editingBooklet) {
      // Edit mode: update with division info
      try {
        const allDivNames = selDivisions.join(', ');
        const desc = bookletForm.description
          ? `${bookletForm.description} (Divisiones: ${allDivNames})`
          : `Divisiones: ${allDivNames}`;

        const payload = {
          ...bookletForm,
          description: desc,
          current_price: Math.round(parseFloat(bookletForm.current_price) * 100),
          stock: 100,
        };
        await adminUpdateBooklet(editingBooklet.id, payload);
        showToast('Cuadernillo actualizado');
        setEditingBooklet(null);
        setErrors({});
      setBookletForm({ course_id: '', division_id: '', title: '', description: '', current_price: '', is_active: true });
        setSelLevel(''); setSelGrade(''); setSelDivisions([]);
        loadData();
      } catch {
        showToast('Error al guardar cuadernillo', 'error');
      }
      return;
    }

    // Create mode: ONE booklet for all selected divisions
    try {
      // Use first division as primary, include all division names in description
      const firstDiv = Object.entries(divisionMap)[0];
      const allDivNames = selDivisions.join(', ');
      const desc = bookletForm.description
        ? `${bookletForm.description} (Divisiones: ${allDivNames})`
        : `Divisiones: ${allDivNames}`;

      const payload = {
        course_id: matchedCourseId,
        division_id: firstDiv[1],
        title: bookletForm.title,
        description: desc,
        current_price: Math.round(parseFloat(bookletForm.current_price) * 100),
        stock: 100,
        is_active: true,
      };
      console.log('Creating booklet with payload:', payload);
      console.log('matchedCourseId:', matchedCourseId, 'divisionMap:', divisionMap);
      await adminCreateBooklet(payload);
      showToast(`Cuadernillo creado para divisiones: ${allDivNames}`);
      setEditingBooklet(null);
      setErrors({});
      setBookletForm({ course_id: '', division_id: '', title: '', description: '', current_price: '', is_active: true });
      setSelLevel(''); setSelGrade(''); setSelDivisions([]);
      loadData();
    } catch (err) {
      console.error('Error creating booklet:', err);
      showToast(`Error al guardar cuadernillo: ${err.response?.data?.message || err.message || 'error desconocido'}`, 'error');
    }
  };

  const handleDeleteBooklet = async (id) => {
    if (!confirm('¿Eliminar este cuadernillo?')) return;
    try {
      await adminDeleteBooklet(id);
      showToast('Cuadernillo eliminado');
      loadData();
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  const formatPrice = (cents) => `$${(cents / 100).toLocaleString('es-AR')}`;

  // Extract division names from description (format: "Divisiones: A, B, C")
  const getDivisionsFromDesc = (desc) => {
    if (!desc) return '';
    const match = desc.match(/Divisiones:\s*(.+)/);
    return match ? match[1].replace(/\s*\(.*\)/, '') : '';
  };

  const availableDivisions = selLevel && selGrade
    ? (COURSE_STRUCTURE[selLevel].getDivisions
      ? COURSE_STRUCTURE[selLevel].getDivisions(selGrade)
      : COURSE_STRUCTURE[selLevel].divisions)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Panel de Administración</h1>
        <p className="mt-1 text-surface-500">Gestioná cuadernillos.</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ring-1 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-red-50 text-red-800 ring-red-200'
        }`}>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Booklets */}
      <div className="space-y-6">
        <div className="card p-5">
          <h3 className="font-semibold text-surface-900 mb-4">
            {editingBooklet ? 'Editar cuadernillo' : 'Nuevo cuadernillo'}
          </h3>

          {/* Structured course selector */}
          <div className="grid gap-4 sm:grid-cols-3 mb-4 p-4 bg-surface-50 rounded-xl">
            <div>
              <label className="label-field">Nivel</label>
              <select
                value={selLevel}
                onChange={(e) => { setSelLevel(e.target.value); setSelGrade(''); setErrors(prev => ({ ...prev, selLevel: '' })); }}
                className={`input-field mt-1.5 ${errors.selLevel ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                disabled={!!editingBooklet}
              >
                <option value="">Seleccioná nivel</option>
                {Object.entries(COURSE_STRUCTURE).map(([key, data]) => (
                  <option key={key} value={key}>{data.label}</option>
                ))}
              </select>
              {errors.selLevel && <p className="text-xs text-red-500 mt-1">{errors.selLevel}</p>}
            </div>
            <div>
              <label className="label-field">Grado / Año</label>
              <select
                value={selGrade}
                onChange={(e) => { setSelGrade(e.target.value); setErrors(prev => ({ ...prev, selGrade: '' })); }}
                className={`input-field mt-1.5 ${errors.selGrade ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                disabled={!selLevel || !!editingBooklet}
              >
                <option value="">Seleccioná grado</option>
                {selLevel && COURSE_STRUCTURE[selLevel].grades.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              {errors.selGrade && <p className="text-xs text-red-500 mt-1">{errors.selGrade}</p>}
            </div>
            <div>
              <label className="label-field">Divisiones</label>
              <div className={`mt-1.5 flex flex-wrap gap-2 ${errors.selDivisions ? 'ring-1 ring-red-400 rounded-lg px-2 py-1 -mx-2 -my-1' : ''}`}>
                {availableDivisions.map((d) => {
                  const checked = selDivisions.includes(d);
                  return (
                    <label
                      key={d}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                        checked
                          ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                          : 'bg-white text-surface-600 ring-1 ring-surface-200 hover:ring-surface-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => { toggleDivision(d); setErrors(prev => ({ ...prev, selDivisions: '' })); }}
                        className="sr-only"
                      />
                      {checked && <span className="text-primary-600">✓</span>}
                      {d}
                    </label>
                  );
                })}
              </div>
              {errors.selDivisions && <p className="text-xs text-red-500 mt-1">{errors.selDivisions}</p>}
            </div>
          </div>

          {/* Booklet fields */}
          {errors.matchedCourse && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.matchedCourse}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label-field">Título</label>
              <input
                type="text"
                value={bookletForm.title}
                onChange={(e) => { setBookletForm({ ...bookletForm, title: e.target.value }); setErrors(prev => ({ ...prev, title: '' })); }}
                className={`input-field mt-1.5 ${errors.title ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                placeholder="Ej: Matemáticas U1"
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="label-field">Precio ($)</label>
              <input
                type="number"
                value={bookletForm.current_price}
                onChange={(e) => { setBookletForm({ ...bookletForm, current_price: e.target.value }); setErrors(prev => ({ ...prev, current_price: '' })); }}
                className={`input-field mt-1.5 ${errors.current_price ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                placeholder="1500.00"
                step="0.01"
                min="0"
              />
              {errors.current_price && <p className="text-xs text-red-500 mt-1">{errors.current_price}</p>}
            </div>
            <div>
              <label className="label-field">Descripción</label>
              <input
                type="text"
                value={bookletForm.description}
                onChange={(e) => setBookletForm({ ...bookletForm, description: e.target.value })}
                className="input-field mt-1.5"
                placeholder="Descripción breve"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <button onClick={handleSaveBooklet} className="btn-primary flex-1">
                {editingBooklet ? 'Actualizar' : `Crear cuadernillo${selDivisions.length > 0 ? ` (${selDivisions.length} división${selDivisions.length > 1 ? 'es' : ''})` : ''}`}
              </button>
              {editingBooklet && (
                <button onClick={() => {
                  setEditingBooklet(null);
                  setErrors({});
        setBookletForm({ course_id: '', division_id: '', title: '', description: '', current_price: '', is_active: true });
                  setSelLevel(''); setSelGrade(''); setSelDivisions([]);
                }} className="btn-secondary">
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Confirmation */}
          {selLevel && selGrade && selDivisions.length > 0 && (
            <p className="mt-3 text-sm text-surface-500">
              Cuadernillo para: <span className="font-medium text-surface-700">{COURSE_STRUCTURE[selLevel].label} - {COURSE_STRUCTURE[selLevel].grades.find(g => g.value === selGrade)?.label} — Divisiones {selDivisions.join(', ')}</span>
              {Object.keys(divisionMap).length === 0 && <span className="text-red-500 ml-2">(⚠ curso no encontrado en la base)</span>}
              {Object.keys(divisionMap).length > 0 && Object.keys(divisionMap).length < selDivisions.length && (
                <span className="text-amber-600 ml-2">
                  ({Object.keys(divisionMap).length}/{selDivisions.length} encontradas en la base)
                </span>
              )}
            </p>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-surface-600">Título</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600">Curso / División</th>
                <th className="text-right px-5 py-3 font-medium text-surface-600">Precio</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600">Estado</th>
                <th className="text-right px-5 py-3 font-medium text-surface-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {booklets.map((b) => {
                const course = courses.find((c) => c.id === b.course_id);
                const division = divisions.find((d) => d.id === b.division_id);
                const divNames = getDivisionsFromDesc(b.description);
                return (
                  <tr key={b.id} className="hover:bg-surface-50">
                    <td className="px-5 py-3 font-medium text-surface-900">{b.title}</td>
                    <td className="px-5 py-3 text-surface-500">
                      {course?.name}
                      {divNames && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-md font-medium">
                          {divNames}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{formatPrice(b.current_price)}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${b.is_active ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-surface-100 text-surface-500'}`}>
                        {b.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingBooklet(b);
                          const parsed = parseCourseName(course?.name || '');
                          setSelLevel(parsed.level);
                          setSelGrade(parsed.grade);
                          // Extract divisions from description
                          const divNames = getDivisionsFromDesc(b.description);
                          setSelDivisions(divNames ? divNames.split(',').map(d => d.trim()) : (division?.name ? [division.name] : []));
                          // Clean description for editing (remove "Divisiones: ..." suffix)
                          const cleanDesc = (b.description || '').replace(/\s*\(Divisiones:.*\)/, '').replace(/Divisiones:.*$/, '').trim();
                          setBookletForm({
                            course_id: b.course_id,
                            division_id: b.division_id,
                            title: b.title,
                            description: cleanDesc,
                            current_price: (b.current_price / 100).toString(),
                            is_active: b.is_active,
                          });
                        }}
                        className="text-primary-600 hover:text-primary-700 mr-3 text-sm font-medium"
                      >
                        Editar
                      </button>
                      <button onClick={() => handleDeleteBooklet(b.id)} className="text-red-600 hover:text-red-700 text-sm font-medium">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {booklets.length === 0 && (
            <div className="text-center py-8 text-surface-500">No hay cuadernillos creados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
