import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
    it('renders label and children', () => {
        render(
            <Field label="Test Label">
                <input data-testid="test-input" />
            </Field>
        );

        expect(screen.getByText('Test Label')).toBeInTheDocument();
        expect(screen.getByTestId('test-input')).toBeInTheDocument();
    });
});
