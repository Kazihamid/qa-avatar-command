CREATE TABLE qa_document_chunks (object_key TEXT NOT NULL, chunk_index INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY (object_key, chunk_index));
