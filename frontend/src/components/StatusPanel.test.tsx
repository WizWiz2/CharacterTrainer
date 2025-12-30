import { render, screen } from '@testing-library/react';
import { StatusPanel } from './StatusPanel';

describe('StatusPanel', () => {
    it('displays job state and logs', () => {
        const logs = ["Step 1", "Step 2"];
        render(
            <StatusPanel
                state="training"
                jobId="123"
                logs={logs}
                artifactPath="path/to/lora"
            />
        );

        expect(screen.getByText('TRAINING')).toBeInTheDocument();
        expect(screen.getByText('123')).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('Step 1'))).toBeInTheDocument();
        expect(screen.getByText('path/to/lora')).toBeInTheDocument();
    });

    it('calculates progress from logs', async () => {
        // Updated test data to include space before colon to match regex /num epochs .*?:\s*(\d+)/i
        const logs = [
            "num epochs : 10",
            "epoch is incremented",
            "epoch is incremented"
        ];
        render(
            <StatusPanel
                state="training"
                jobId="123"
                logs={logs}
                artifactPath=""
            />
        );

        expect(await screen.findByText("20%")).toBeInTheDocument();
    });
});
