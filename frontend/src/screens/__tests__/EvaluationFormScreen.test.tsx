/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EvaluationFormScreen from '../EvaluationFormScreen';
import { workspaceRequest } from '../../lib/eventWorkspace';

jest.mock('../../lib/eventWorkspace', () => ({ workspaceRequest: jest.fn() }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../config/api', () => ({ API_URL: '' }));
jest.mock('../../components/FeedbackModal', () => ({ FeedbackModal: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('lucide-react-native', () => Object.fromEntries(
  ['Activity', 'ArrowLeft', 'Briefcase', 'ClipboardCheck', 'Edit3', 'Plus', 'Star', 'Trash2', 'X']
    .map(name => [name, () => null]),
));

test('one registration editor loads and saves questions for the selected category', async () => {
  const studentPath = '/summit/roles/student/pre-registration-template';
  const alumniPath = '/summit/roles/alumni/pre-registration-template';
  const page = (title: string) => ({ id: 'intro', title, description: '', questions: [] });
  const url = 'https://forms.example.edu/forms/summit?type=pre-registration';
  jest.mocked(workspaceRequest).mockImplementation(async <T,>(path?: string, body?: object) => {
    if (body) return { url } as T;
    return { questions: [page(path === studentPath ? 'Student questions' : 'Alumni questions')] } as T;
  });
  render(<EvaluationFormScreen navigation={{}} route={{ params: {
    eventId: 'summit', eventName: 'CCS Summit', formType: 'pre-registration',
    registrationRoles: [{ id: 'student', name: 'Student' }, { id: 'alumni', name: 'Alumni' }],
  } }} />);

  fireEvent.changeText(await screen.findByDisplayValue('Student questions'), 'Updated student questions');
  fireEvent.press(screen.getByRole('tab', { name: 'Alumni' }));
  expect(await screen.findByDisplayValue('Alumni questions')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Student' }));
  expect(screen.getByDisplayValue('Updated student questions')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save category questions' }));
  await waitFor(() => expect(workspaceRequest).toHaveBeenLastCalledWith(studentPath, {
    title: 'Updated student questions', questions: [page('Updated student questions')],
  }));
  expect(workspaceRequest).toHaveBeenCalledWith(alumniPath);
});
