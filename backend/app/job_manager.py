from __future__ import annotations

import enum
from dataclasses import dataclass, field
from threading import Lock
from typing import Dict, List, Optional


class JobState(str, enum.Enum):
    PREPPING = "prepping"
    TRAINING = "training"
    COPYING = "copying"
    DONE = "done"
    ERROR = "error"


@dataclass
class JobRecord:
    job_id: str
    state: JobState = JobState.PREPPING
    logs: List[str] = field(default_factory=list)
    artifact_path: Optional[str] = None
    error: Optional[str] = None
    params: Dict[str, str] = field(default_factory=dict)


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}
        self._lock = Lock()

    def create_job(self, job: JobRecord) -> JobRecord:
        with self._lock:
            self._jobs[job.job_id] = job
        return job

    def get(self, job_id: str) -> Optional[JobRecord]:
        with self._lock:
            return self._jobs.get(job_id)

    def set_state(self, job_id: str, state: JobState) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.state = state

    def append_log(self, job_id: str, message: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.logs.append(message)

    def set_artifact(self, job_id: str, path: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.artifact_path = path

    def set_error(self, job_id: str, message: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.error = message
            job.state = JobState.ERROR

    def to_dict(self, job_id: str) -> Dict[str, Optional[str]]:
        job = self.get(job_id)
        if not job:
            raise KeyError(job_id)
        return {
            "job_id": job.job_id,
            "state": job.state.value,
            "logs": job.logs,
            "artifact_path": job.artifact_path,
            "error": job.error,
        }


job_manager = JobManager()
