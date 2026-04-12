import copy
import os
import sys
from pathlib import Path
from uuid import uuid4


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

os.environ.setdefault("SUPABASE_URL", "http://127.0.0.1:54321")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("OLLAMA_HOST", "http://127.0.0.1:11434")
os.environ.setdefault("OLLAMA_MODEL", "llama3.1")
os.environ.setdefault("WHISPER_MODEL", "base")


class FakeResult:
    def __init__(self, data=None, error=None):
        self.data = data
        self.error = error


class FakeStorageBucket:
    def __init__(self, files):
        self.files = files

    def download(self, path):
        return self.files.get(path)

    def upload(self, path, contents, **_kwargs):
        self.files[path] = contents
        return {"path": path}

    def remove(self, paths):
        for path in paths:
            self.files.pop(path, None)


class FakeStorageClient:
    def __init__(self, files):
        self.files = files

    def from_(self, _bucket):
        return FakeStorageBucket(self.files)


class FakeTable:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self.reset()

    def reset(self):
        self.operation = "select"
        self.columns = "*"
        self.filters = []
        self.sort = None
        self.payload = None
        self.return_single = False
        return self

    def _filtered_rows(self):
        rows = copy.deepcopy(self.store.setdefault(self.name, []))
        for field, operator, value in self.filters:
            if operator == "eq":
                rows = [row for row in rows if row.get(field) == value]
            elif operator == "in":
                rows = [row for row in rows if row.get(field) in value]
        if self.sort:
            field, descending = self.sort
            rows.sort(key=lambda row: row.get(field), reverse=descending)
        return rows

    def select(self, columns="*"):
        self.operation = "select"
        self.columns = columns
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, field, value):
        self.filters.append((field, "eq", value))
        return self

    def in_(self, field, values):
        self.filters.append((field, "in", set(values)))
        return self

    def order(self, field, desc=False):
        self.sort = (field, desc)
        return self

    def single(self):
        self.return_single = True
        return self

    def maybeSingle(self):
        self.return_single = True
        return self

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        filtered = self._filtered_rows()

        if self.operation == "select":
            data = filtered[0] if self.return_single and filtered else (None if self.return_single else filtered)
            self.reset()
            return FakeResult(data=data)

        if self.operation == "insert":
            new_rows = self.payload if isinstance(self.payload, list) else [self.payload]
            inserted_rows = []
            for row in new_rows:
                record = copy.deepcopy(row)
                record.setdefault("id", str(uuid4()))
                rows.append(record)
                inserted_rows.append(record)
            data = inserted_rows[0] if self.return_single else inserted_rows
            self.reset()
            return FakeResult(data=data)

        if self.operation == "update":
            updated_rows = []
            for row in rows:
                matches = True
                for field, operator, value in self.filters:
                    if operator == "eq" and row.get(field) != value:
                        matches = False
                        break
                    if operator == "in" and row.get(field) not in value:
                        matches = False
                        break
                if matches:
                    row.update(copy.deepcopy(self.payload))
                    updated_rows.append(copy.deepcopy(row))
            data = updated_rows[0] if self.return_single and updated_rows else updated_rows
            self.reset()
            return FakeResult(data=data)

        if self.operation == "delete":
            deleted_rows = []
            kept_rows = []
            for row in rows:
                matches = True
                for field, operator, value in self.filters:
                    if operator == "eq" and row.get(field) != value:
                        matches = False
                        break
                    if operator == "in" and row.get(field) not in value:
                        matches = False
                        break
                if matches:
                    deleted_rows.append(copy.deepcopy(row))
                else:
                    kept_rows.append(row)
            self.store[self.name] = kept_rows
            data = deleted_rows[0] if self.return_single and deleted_rows else deleted_rows
            self.reset()
            return FakeResult(data=data)

        raise RuntimeError(f"Unsupported operation: {self.operation}")


class FakeSupabase:
    def __init__(self, initial_tables=None, files=None):
        self.tables = copy.deepcopy(initial_tables or {})
        self.files = dict(files or {})
        self.storage = FakeStorageClient(self.files)

    def table(self, name):
        return FakeTable(self.tables, name)

    def from_(self, name):
        return self.table(name)
