import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { App } from '../entrypoints/popup/App';

describe('popup app', () => {
  it('renders category controls and a safe idle state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'a11y-lens' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Запустить аудит' })).toBeTruthy();
    expect(screen.getByText('Выберите категории и запустите аудит текущей вкладки.')).toBeTruthy();
  });
});
