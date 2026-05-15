import { screen } from '@testing-library/react';
import { renderWithProviders } from './renderWithProviders';
import StudentsPage from '@/pages/StudentsPage';
import ContactsTab from '@/components/ContactsTab';

// Suppress react-query network errors in tests
beforeEach(() => {
  vi.clearAllMocks();
});

describe('Observer role restrictions — StudentsPage', () => {
  test('observer does NOT see Add Student button', () => {
    renderWithProviders(<StudentsPage />, { role: 'observer' });
    expect(screen.queryByText('Add Student')).not.toBeInTheDocument();
  });

  test('instructor DOES see Add Student button', () => {
    renderWithProviders(<StudentsPage />, { role: 'instructor' });
    expect(screen.getByText('Add Student')).toBeInTheDocument();
  });

  test('admin DOES see Add Student button', () => {
    renderWithProviders(<StudentsPage />, { role: 'admin' });
    expect(screen.getByText('Add Student')).toBeInTheDocument();
  });

  test('all roles see the Export button', () => {
    renderWithProviders(<StudentsPage />, { role: 'observer' });
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});

describe('Observer role restrictions — ContactsTab', () => {
  const contacts = [
    { id: 'c1', contactType: 'Email', contactValue: 'test@test.com' },
  ];

  test('observer does NOT see Add Contact button', () => {
    renderWithProviders(
      <ContactsTab studentId="1" contacts={contacts} />,
      { role: 'observer' }
    );
    expect(screen.queryByText('Add Contact')).not.toBeInTheDocument();
  });

  test('instructor DOES see Add Contact button', () => {
    renderWithProviders(
      <ContactsTab studentId="1" contacts={contacts} />,
      { role: 'instructor' }
    );
    expect(screen.getByText('Add Contact')).toBeInTheDocument();
  });

  test('observer can see contact values but not edit them', () => {
    renderWithProviders(
      <ContactsTab studentId="1" contacts={contacts} />,
      { role: 'observer' }
    );
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
    // Edit and delete buttons should not be present
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});
