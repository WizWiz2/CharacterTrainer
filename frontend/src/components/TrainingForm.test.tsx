import { render, screen, fireEvent } from '@testing-library/react';
import { TrainingForm } from './TrainingForm';
import { vi } from 'vitest';

const defaultParams = {
    name: "test-char",
    trigger: "trigger",
    baseModel: "sd15",
    resolution: 512,
    networkDim: 32,
    steps: 1000,
    unetOnly: true,
    weight: "1.0"
};

describe('TrainingForm', () => {
    it('renders all fields', () => {
        render(<TrainingForm params={defaultParams} onChange={() => { }} />);

        expect(screen.getByDisplayValue('test-char')).toBeInTheDocument();
        expect(screen.getByDisplayValue('trigger')).toBeInTheDocument();
    });

    it('calls onChange when input changes', () => {
        const handleChange = vi.fn();
        render(<TrainingForm params={defaultParams} onChange={handleChange} />);

        const nameInput = screen.getByDisplayValue('test-char');
        fireEvent.change(nameInput, { target: { value: 'new-name' } });

        expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'new-name' }));
    });
});
