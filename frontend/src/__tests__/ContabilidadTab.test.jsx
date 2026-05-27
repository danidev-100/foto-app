/**
 * ContabilidadTab frontend tests.
 *
 * Covers:
 *  - Renders "Contabilidad" as heading
 *  - Shows school selector
 *  - Shows loading state initially
 *  - Shows "No hay cuadernillos" when empty
 *  - Renders summary table with data
 *  - Click on a row to see detail view
 *  - Toggle student status in detail view
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthProvider';
import ContabilidadTab from '../pages/ContabilidadTab';

// Create mock functions via hoisted block (runs before any import, including vi.mock factories)
const { adminGetProgressSummary, adminGetBookletProgress, adminUpdateProgress, adminGetSchools } = vi.hoisted(() => ({
  adminGetProgressSummary: vi.fn(),
  adminGetBookletProgress: vi.fn(),
  adminUpdateProgress: vi.fn(),
  adminGetSchools: vi.fn(),
}));

// Mock react-router-dom for nav elements
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
  };
});

// Mock client module to avoid import.meta.env issues
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock API modules - use hoisted variables so beforeEach can reference them
vi.mock('../api/admin', () => ({
  adminGetProgressSummary,
  adminGetBookletProgress,
  adminUpdateProgress,
  adminGetSchools,
}));

// Mock auth context to provide an admin user
const mockUser = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@test.com',
  isAdmin: true,
};

function renderContabilidad() {
  return render(
    <AuthProvider initialUser={mockUser}>
      <BrowserRouter>
        <ContabilidadTab />
      </BrowserRouter>
    </AuthProvider>
  );
}

// Mock data
const mockSchools = [
  { id: 's1', name: 'Don Bosco Test', shortName: 'DB', courses: [] },
  { id: 's2', name: 'Instituto Rodeo Test', shortName: 'IR', courses: [] },
];

const mockProgressSummary = [
  {
    booklet_id: 'b1',
    booklet_title: 'Matemática U1',
    course_name: 'Primaria - 1° Primero',
    school_name: 'Don Bosco Test',
    total_students: 10,
    completed: 4,
    pending: 6,
    percentage: 40,
  },
  {
    booklet_id: 'b2',
    booklet_title: 'Lengua U1',
    course_name: 'Primaria - 1° Primero',
    school_name: 'Don Bosco Test',
    total_students: 8,
    completed: 8,
    pending: 0,
    percentage: 100,
  },
];

const mockBookletDetail = {
  booklet_id: 'b1',
  booklet_title: 'Matemática U1',
  students: [
    {
      progress_id: 'p1',
      student_id: 's1',
      student_name: 'Juan Pérez',
      status: 'completed',
      updated_at: '2026-05-27T00:00:00.000Z',
    },
    {
      progress_id: 'p2',
      student_id: 's2',
      student_name: 'María Gómez',
      status: 'pending',
      updated_at: '2026-05-27T00:00:00.000Z',
    },
  ],
};

describe('ContabilidadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    adminGetSchools.mockResolvedValue({ data: { data: mockSchools } });
    adminGetProgressSummary.mockResolvedValue({ data: { data: mockProgressSummary } });
    adminGetBookletProgress.mockResolvedValue({ data: { data: mockBookletDetail } });
    adminUpdateProgress.mockResolvedValue({ data: { success: true } });
  });

  it('renders "Contabilidad" as heading', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Contabilidad')).toBeInTheDocument();
    });
  });

  it('shows school selector', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Don Bosco Test')).toBeInTheDocument();
      expect(screen.getByText('Instituto Rodeo Test')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', async () => {
    // Delay API response to keep loading visible
    adminGetSchools.mockImplementationOnce(() => new Promise(() => {}));

    renderContabilidad();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows "No hay cuadernillos" when empty', async () => {
    adminGetProgressSummary.mockResolvedValue({ data: { data: [] } });

    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('No hay cuadernillos')).toBeInTheDocument();
    });
  });

  it('renders summary table with data', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
      expect(screen.getByText('Lengua U1')).toBeInTheDocument();
      expect(screen.getByText('4/10')).toBeInTheDocument();
      expect(screen.getByText('8/8')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  it('click on a row to see detail view', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Matemática U1'));

    await waitFor(() => {
      // Detail view shows booklet detail
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('María Gómez')).toBeInTheDocument();
      expect(screen.getByText('Volver')).toBeInTheDocument();
    });

    // Verify the detail API was called for this booklet
    expect(adminGetBookletProgress).toHaveBeenCalledWith('b1');
  });

  it('toggle student status in detail view', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Matemática U1'));

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('María Gómez')).toBeInTheDocument();
    });

    // Click "Marcar como listo" for the pending student (María Gómez)
    const marcarListoButtons = screen.getAllByText('Marcar como listo');
    expect(marcarListoButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(marcarListoButtons[0]);

    // After toggle, verify the API was called with the correct args
    await waitFor(() => {
      expect(adminUpdateProgress).toHaveBeenCalledWith('p2', 'completed');
    });
  });

  // ── TRIANGULATION TESTS ──

  it('filters summary table when a school is selected', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const schoolSelect = screen.getByRole('combobox');
    await user.selectOptions(schoolSelect, 's2'); // Instituto Rodeo Test

    await waitFor(() => {
      expect(screen.getByText('No hay cuadernillos')).toBeInTheDocument();
    });

    // Booklets from Don Bosco should disappear
    expect(screen.queryByText('Matemática U1')).not.toBeInTheDocument();
    expect(screen.queryByText('Lengua U1')).not.toBeInTheDocument();
  });

  it('goes back from detail view to summary', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Matemática U1'));

    await waitFor(() => {
      expect(screen.getByText('Volver')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Volver'));

    // Summary view should be back
    await waitFor(() => {
      expect(screen.getByText('Contabilidad')).toBeInTheDocument();
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });
  });

  it('toggles completed student to pending', async () => {
    renderContabilidad();

    await waitFor(() => {
      expect(screen.getByText('Matemática U1')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Matemática U1'));

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    // Juan Pérez is completed; his button should say "Marcar como pendiente"
    const marcarPendienteBtn = screen.getByText('Marcar como pendiente');
    expect(marcarPendienteBtn).toBeInTheDocument();

    await user.click(marcarPendienteBtn);

    // Verify API called to mark as pending
    await waitFor(() => {
      expect(adminUpdateProgress).toHaveBeenCalledWith('p1', 'pending');
    });

    // Verify optimistic UI update: both students now show "Marcar como listo"
    await waitFor(() => {
      const buttons = screen.getAllByText('Marcar como listo');
      expect(buttons.length).toBe(2);
    });
  });
});
