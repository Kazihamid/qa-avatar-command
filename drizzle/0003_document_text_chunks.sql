ALTER TABLE qa_documents ADD COLUMN text_length INTEGER;
CREATE TABLE qa_document_text_chunks (document_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY (document_id, chunk_index));
