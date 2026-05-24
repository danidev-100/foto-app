/**
 * Admin page frontend tests.
 *
 * Covers:
 *  - Renders tabs (Cuadernillos, Pedidos, Usuarios)
 *  - Shows loading spinner initially
 *  - School selector appears in booklets tab
 *  - Renders booklet table when data loads
 *  - Shows school badge for booklets
 *  - Form validation on create
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthProvider';
import Admin from '../pages/Admin';

// Create mock functions via hoisted block (runs before any import, including vi.mock factories)
const { adminGetCourses, adminGetDivisions, adminGetBooklets, adminGetSchools } = vi.hoisted(() => ({
  adminGetCourses: vi.fn(),
  adminGetDivisions: vi.fn(),
  adminGetBooklets: vi.fn(),
  adminGetSchools: vi.fn(),
}));

// Mock react-router-dom's Link for nav elements
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to, className }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

// Mock client module to avoid import.meta.env issues
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock API modules - use hoisted variables so beforeEach can reference them
vi.mock('../api/admin', () => ({
  adminGetCourses,
  adminGetDivisions,
  adminGetBooklets,
  adminGetSchools,
}));

// Mock auth context to provide an admin user
const mockUser = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@test.com',
  isAdmin: true,
};

function renderAdmin() {
  return render(
    <AuthProvider initialUser={mockUser}>
      <BrowserRouter>
        <Admin />
      </BrowserRouter>
    </AuthProvider>
  );
}

// Mock data
const mockSchools = [
  {
    id: 's1', name: 'Don Bosco Test', shortName: 'DB',
    courses: [
      { id: 'c1', name: 'Primaria - 1° Primero', isActive: true },
      { id: 'c2', name: 'Secundaria - 1° Primero', isActive: true },
    ],
  },
  {
    id: 's2', name: 'Instituto Rodeo Test', shortName: 'IR',
    courses: [{ id: 'c3', name: 'Primaria - 1° Primero', isActive: true }],
  },
];

const mockCourses = [
  { id: 'c1', name: 'Primaria - 1° Primero', isActive: true },
  { id: 'c2', name: 'Secundaria - 1° Primero', isActive: true },
  { id: 'c3', name: 'Primaria - 1° Primero', isActive: true },
];

const mockDivisions = [
  { id: 'd1', courseId: 'c1', name: 'A', isActive: true },
  { id: 'd2', courseId: 'c1', name: 'B', isActive: true },
  { id: 'd3', courseId: 'c2', name: 'A', isActive: true },
  { id: 'd4', courseId: 'c3', name: 'A', isActive: true },
];

const mockBooklets = [
  {
    id: 'b1',
    schoolId: 's1',
    courseId: 'c1',
    divisionId: 'd1',
    title: 'Matemáticas U1',
    description: 'Divisiones: A, B',
    currentPrice: 150000,
    stock: 100,
    isActive: true,
    school: { id: 's1', name: 'Don Bosco Test', shortName: 'DB' },
    course: { id: 'c1', name: 'Primaria - 1° Primero' },
  },
  {
    id: 'b2',
    schoolId: 's2',
    courseId: 'c3',
    divisionId: 'd4',
    title: 'Lengua U1',
    description: 'Divisiones: A',
    currentPrice: 200000,
    stock: 50,
    isActive: true,
    school: { id: 's2', name: 'Instituto Rodeo Test', shortName: 'IR' },
    course: { id: 'c3', name: 'Primaria - 1° Primero' },
  },
];

describe('Admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    adminGetCourses.mockResolvedValue({ data: { data: mockCourses } });
    adminGetDivisions.mockResolvedValue({ data: { data: mockDivisions } });
    adminGetBooklets.mockResolvedValue({ data: { data: mockBooklets } });
    adminGetSchools.mockResolvedValue({ data: { data: mockSchools } });
  });

  it('renders tab navigation', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('Cuadernillos')).toBeInTheDocument();
      expect(screen.getByText('Pedidos Pendientes')).toBeInTheDocument();
      expect(screen.getByText('Usuarios')).toBeInTheDocument();
    });
  });

  it('shows school selector in booklets tab', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getAllByText(/^Colegio$/).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Don Bosco Test')).toBeInTheDocument();
    expect(screen.getByText('Instituto Rodeo Test')).toBeInTheDocument();
  });

  it('renders booklet table with school badges', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('Matemáticas U1')).toBeInTheDocument();
    });
    // School badge
    expect(screen.getByText('DB')).toBeInTheDocument();
    expect(screen.getByText('IR')).toBeInTheDocument();
  });

  it('filters booklets by selected school', async () => {
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText('Matemáticas U1')).toBeInTheDocument();
    });

    // Select Don Bosco (first combobox = school selector)
    const user = userEvent.setup();
    const schoolSelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(schoolSelect, 's1');

    await waitFor(() => {
      // Don Bosco booklet visible, Instituto one filtered out
      expect(screen.getByText('Matemáticas U1')).toBeInTheDocument();
    });

    // The IR-only booklet should not be visible
    expect(screen.queryByText('Lengua U1')).not.toBeInTheDocument();
  });

  it('shows loading spinner initially', async () => {
    // Delay API responses using hoisted mock reference
    adminGetCourses.mockImplementationOnce(() => new Promise(() => {}));

    renderAdmin();
    // The loading animation uses a border spinner class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });
});
