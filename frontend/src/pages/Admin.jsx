import { useState, useEffect } from 'react';
import {
  adminGetCourses, adminGetDivisions,
  adminGetBooklets, adminCreateBooklet, adminUpdateBooklet, adminDeleteBooklet,
  adminGetOrders,
  adminSearchOrderByID, adminSearchOrdersByStudentName, adminSearchOrdersByBookletTitle,
} from '../api/admin';
import { listStudents, updateStudent } from '../api/students';
import api from '../api/client';

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
  const [activeTab, setActiveTab] = useState('booklets');
  const [courses, setCourses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [booklets, setBooklets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [studentNames, setStudentNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Order search state
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchOrderResult, setSearchOrderResult] = useState(null);
  const [searchStudentName, setSearchStudentName] = useState('');
  const [searchStudentResults, setSearchStudentResults] = useState([]);
  const [searchStudentNames, setSearchStudentNames] = useState({});
  const [searchBookletTitle, setSearchBookletTitle] = useState('');
  const [searchBookletResults, setSearchBookletResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Users tab state
  const [students, setStudents] = useState([]);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsLoading, setStudentsLoading] = useState(false);

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

  const loadOrders = async () => {
    try {
      console.log('Loading orders...');
      const res = await adminGetOrders({ status: 'pending' });
      console.log('Orders response:', res.data);
      const responseData = res.data.data || {};
      console.log('Response data:', responseData);
      setOrders(responseData.orders || []);
      setStudentNames(responseData.student_names || {});
    } catch (error) {
      console.error('Error loading orders:', error);
      console.error('Error response:', error.response?.data);
      showToast(`Error al cargar pedidos: ${error.response?.data?.error?.message || error.message}`, 'error');
    }
  };

  // Order search handlers
  const handleSearchOrderId = async () => {
    if (!searchOrderId.trim()) return;
    setSearchLoading(true);
    setSearchOrderResult(null);
    try {
      const res = await adminSearchOrderByID(searchOrderId.trim());
      setSearchOrderResult(res.data.data);
    } catch {
      showToast('Pedido no encontrado', 'error');
      setSearchOrderResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchStudentName = async () => {
    if (!searchStudentName.trim()) return;
    setSearchLoading(true);
    setSearchStudentResults([]);
    try {
      const res = await adminSearchOrdersByStudentName(searchStudentName.trim());
      const data = res.data.data || {};
      setSearchStudentResults(data.orders || []);
      setSearchStudentNames(data.student_names || {});
    } catch {
      showToast('Error al buscar', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchBookletTitle = async () => {
    if (!searchBookletTitle.trim()) return;
    setSearchLoading(true);
    setSearchBookletResults([]);
    try {
      const res = await adminSearchOrdersByBookletTitle(searchBookletTitle.trim());
      setSearchBookletResults(res.data.data || []);
    } catch {
      showToast('Error al buscar', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearchOrder = () => {
    setSearchOrderId('');
    setSearchOrderResult(null);
  };

  const clearSearchStudent = () => {
    setSearchStudentName('');
    setSearchStudentResults([]);
    setSearchStudentNames({});
  };

  const clearSearchBooklet = () => {
    setSearchBookletTitle('');
    setSearchBookletResults([]);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'orders') loadOrders(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'users') loadStudents(); }, [activeTab]);

  const loadStudents = async (page = studentsPage) => {
    setStudentsLoading(true);
    try {
      const res = await listStudents(page, 20);
      setStudents(res.data.data || []);
      setStudentsTotal(res.data.pagination?.total || 0);
      setStudentsPage(page);
    } catch {
      showToast('Error al cargar usuarios', 'error');
    } finally {
      setStudentsLoading(false);
    }
  };

  const toggleStudentRole = async (student) => {
    try {
      await updateStudent(student.id, { is_admin: !student.is_admin });
      showToast(`Rol de ${student.name} actualizado`);
      loadStudents(studentsPage);
    } catch {
      showToast('Error al actualizar rol', 'error');
    }
  };

  const toggleStudentStatus = async (student) => {
    try {
      await updateStudent(student.id, { is_active: !student.is_active });
      showToast(`Estado de ${student.name} actualizado`);
      loadStudents(studentsPage);
    } catch {
      showToast('Error al actualizar estado', 'error');
    }
  };

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
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Panel de Administración</h1>
        <p className="mt-1 text-surface-500 dark:text-surface-400">Gestioná cuadernillos y pedidos.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('booklets')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'booklets'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
        >
          Cuadernillos
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'orders'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
        >
          Pedidos Pendientes
          {orders.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
              {orders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
        >
          Usuarios
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg ring-1 ${
          toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 ring-green-200 dark:ring-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-800'
        }`}>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Booklets Tab */}
      {activeTab === 'booklets' && (
      <div className="space-y-6">
        <div className="card p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">
            {editingBooklet ? 'Editar cuadernillo' : 'Nuevo cuadernillo'}
          </h3>

          {/* Structured course selector */}
          <div className="grid gap-4 sm:grid-cols-3 mb-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
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
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700'
                          : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 ring-1 ring-surface-200 dark:ring-surface-600 hover:ring-surface-300 dark:hover:ring-surface-500'
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
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
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
            <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
              Cuadernillo para: <span className="font-medium text-surface-700 dark:text-surface-300">{COURSE_STRUCTURE[selLevel].label} - {COURSE_STRUCTURE[selLevel].grades.find(g => g.value === selGrade)?.label} — Divisiones {selDivisions.join(', ')}</span>
              {Object.keys(divisionMap).length === 0 && <span className="text-red-500 dark:text-red-400 ml-2">(⚠ curso no encontrado en la base)</span>}
              {Object.keys(divisionMap).length > 0 && Object.keys(divisionMap).length < selDivisions.length && (
                <span className="text-amber-600 dark:text-amber-400 ml-2">
                  ({Object.keys(divisionMap).length}/{selDivisions.length} encontradas en la base)
                </span>
              )}
            </p>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Título</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Curso / División</th>
                <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Precio</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {booklets.map((b) => {
                const course = courses.find((c) => c.id === b.course_id);
                const division = divisions.find((d) => d.id === b.division_id);
                const divNames = getDivisionsFromDesc(b.description);
                return (
                  <tr key={b.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">{b.title}</td>
                    <td className="px-5 py-3 text-surface-500 dark:text-surface-400">
                      {course?.name}
                      {divNames && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-md font-medium">
                          {divNames}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-surface-900 dark:text-surface-100">{formatPrice(b.current_price)}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${b.is_active ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'}`}>
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
            <div className="text-center py-8 text-surface-500 dark:text-surface-400">No hay cuadernillos creados.</div>
          )}
        </div>
      </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Search Section */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">Buscar Pedidos</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Search by Order ID */}
              <div>
                <label className="label-field">N° de Pedido</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={searchOrderId}
                    onChange={(e) => setSearchOrderId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchOrderId()}
                    className="input-field flex-1"
                    placeholder="UUID o primeros 8 caracteres"
                  />
                  <button onClick={handleSearchOrderId} className="btn-primary text-sm px-3" disabled={searchLoading}>
                    Buscar
                  </button>
                </div>
              </div>
              {/* Search by Student Name */}
              <div>
                <label className="label-field">Nombre del Estudiante</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={searchStudentName}
                    onChange={(e) => setSearchStudentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchStudentName()}
                    className="input-field flex-1"
                    placeholder="Nombre completo o parcial"
                  />
                  <button onClick={handleSearchStudentName} className="btn-primary text-sm px-3" disabled={searchLoading}>
                    Buscar
                  </button>
                </div>
              </div>
              {/* Search by Booklet Title */}
              <div>
                <label className="label-field">Cuadernillo</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="text"
                    value={searchBookletTitle}
                    onChange={(e) => setSearchBookletTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchBookletTitle()}
                    className="input-field flex-1"
                    placeholder="Título del cuadernillo"
                  />
                  <button onClick={handleSearchBookletTitle} className="btn-primary text-sm px-3" disabled={searchLoading}>
                    Buscar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search Results: Order by ID */}
          {searchOrderResult && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800 flex items-center justify-between">
                <h4 className="font-semibold text-primary-800 dark:text-primary-300 text-sm">
                  Resultado: Pedido #{searchOrderResult.order.id.slice(0, 8)}
                </h4>
                <button onClick={clearSearchOrder} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 font-medium">
                  ✕ Limpiar
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pedido</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Usuario</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cuadernillos</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Total</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  <tr className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-surface-900 dark:text-surface-100">#{searchOrderResult.order.id.slice(0, 8)}</span>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        {new Date(searchOrderResult.order.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-surface-700 dark:text-surface-300">{searchOrderResult.student_name}</td>
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        {(searchOrderResult.items || []).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                            <span className="text-xs bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">{item.quantity}x</span>
                            <span className="text-sm">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-surface-900 dark:text-surface-100">{formatPrice(searchOrderResult.order.total)}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${
                        searchOrderResult.order.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800' :
                        searchOrderResult.order.status === 'confirmed' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800' :
                        searchOrderResult.order.status === 'delivered' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' :
                        'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'
                      }`}>{searchOrderResult.order.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${
                        searchOrderResult.order.payment_method === 'cash' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' :
                        'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800'
                      }`}>{searchOrderResult.order.payment_method === 'cash' ? 'Efectivo' : 'Mercado Pago'}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Search Results: By Student Name */}
          {searchStudentResults.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800 flex items-center justify-between">
                <h4 className="font-semibold text-primary-800 dark:text-primary-300 text-sm">
                  Pedidos de "{searchStudentName}" ({searchStudentResults.length} encontrado{searchStudentResults.length !== 1 ? 's' : ''})
                </h4>
                <button onClick={clearSearchStudent} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 font-medium">
                  ✕ Limpiar
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pedido</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Usuario</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cuadernillos</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Total</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {searchStudentResults.map((orderData) => {
                    const order = orderData.order;
                    const items = orderData.items || [];
                    const name = searchStudentNames[order.student_id] || '—';
                    return (
                      <tr key={order.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                        <td className="px-5 py-3">
                          <span className="font-medium text-surface-900 dark:text-surface-100">#{order.id.slice(0, 8)}</span>
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                            {new Date(order.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-surface-700 dark:text-surface-300">{name}</td>
                        <td className="px-5 py-3">
                          <div className="space-y-1">
                            {items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                                <span className="text-xs bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">{item.quantity}x</span>
                                <span className="text-sm">{item.title}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-surface-900 dark:text-surface-100">{formatPrice(order.total)}</td>
                        <td className="px-5 py-3">
                          <span className={`badge ${
                            order.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800' :
                            order.status === 'confirmed' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800' :
                            order.status === 'delivered' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' :
                            'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'
                          }`}>{order.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Search Results: By Booklet Title */}
          {searchBookletResults.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800 flex items-center justify-between">
                <h4 className="font-semibold text-primary-800 dark:text-primary-300 text-sm">
                  Cuadernillo "{searchBookletTitle}" ({searchBookletResults.length} encontrado{searchBookletResults.length !== 1 ? 's' : ''})
                </h4>
                <button onClick={clearSearchBooklet} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 font-medium">
                  ✕ Limpiar
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estudiante</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pedido</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cuadernillo</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cantidad</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {searchBookletResults.map((result, idx) => (
                    <tr key={idx} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                      <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">{result.student_name}</td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-surface-900 dark:text-surface-100">#{result.order_id.slice(0, 8)}</span>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                          {new Date(result.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-surface-700 dark:text-surface-300">{result.booklet_title}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{result.quantity}x</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${
                          result.order_status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800' :
                          result.order_status === 'confirmed' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800' :
                          result.order_status === 'delivered' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' :
                          'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'
                        }`}>{result.order_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All Pending Orders Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              <h4 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">Todos los Pedidos Pendientes</h4>
            </div>
            <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Pedido</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Usuario</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Cuadernillos</th>
                <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Total</th>
                <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {orders.map((orderData) => {
                const order = orderData.order;
                const items = orderData.items || [];
                const studentName = studentNames[order.student_id] || '—';
                return (
                  <tr key={order.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-surface-900 dark:text-surface-100">#{order.id.slice(0, 8)}</span>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-surface-700 dark:text-surface-300">{studentName}</td>
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                            <span className="text-xs bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded">{item.quantity}x</span>
                            <span className="text-sm">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-surface-900 dark:text-surface-100">{formatPrice(order.total)}</td>
                    <td className="px-5 py-3">
                      <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800">Pendiente</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="text-center py-8 text-surface-500 dark:text-surface-400">No hay pedidos pendientes.</div>
          )}
        </div>
      </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {studentsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Nombre</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Email</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Rol</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Estado</th>
                      <th className="text-right px-5 py-3 font-medium text-surface-600 dark:text-surface-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                        <td className="px-5 py-3 font-medium text-surface-900 dark:text-surface-100">{s.name}</td>
                        <td className="px-5 py-3 text-surface-500 dark:text-surface-400">{s.email}</td>
                        <td className="px-5 py-3">
                          <span className={`badge ${s.is_admin ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800' : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'}`}>
                            {s.is_admin ? 'Admin' : 'Estudiante'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`badge ${s.is_active ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800'}`}>
                            {s.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => toggleStudentRole(s)}
                            className="btn-secondary text-xs mr-2"
                          >
                            {s.is_admin ? 'Quitar admin' : 'Hacer admin'}
                          </button>
                          <button
                            onClick={() => toggleStudentStatus(s)}
                            className="btn-secondary text-xs"
                          >
                            {s.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 && (
                  <div className="text-center py-8 text-surface-500 dark:text-surface-400">No hay usuarios registrados.</div>
                )}
              </div>

              {/* Pagination */}
              {studentsTotal > 20 && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-surface-500 dark:text-surface-400">
                    {studentsTotal} usuarios
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadStudents(studentsPage - 1)}
                      disabled={studentsPage === 1}
                      className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-2 text-sm text-surface-600 dark:text-surface-400">
                      Página {studentsPage}
                    </span>
                    <button
                      onClick={() => loadStudents(studentsPage + 1)}
                      disabled={studentsPage * 20 >= studentsTotal}
                      className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
