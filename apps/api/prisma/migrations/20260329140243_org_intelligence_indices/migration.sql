-- InterviewChunk: HNSW index for vector search
CREATE INDEX idx_interview_chunks_embedding_hnsw ON interview_chunks
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);

-- InterviewChunk: tsvector auto-update trigger (Spanish, weighted A/B/C)
CREATE OR REPLACE FUNCTION interview_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('spanish', COALESCE(NEW."topicSummary", '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW."contextPrefix", '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_interview_chunks_tsv
  BEFORE INSERT OR UPDATE OF content, "contextPrefix", "topicSummary"
  ON interview_chunks
  FOR EACH ROW
  EXECUTE FUNCTION interview_chunks_tsv_trigger();

-- InterviewChunk: GIN index for full-text search
CREATE INDEX idx_interview_chunks_tsv ON interview_chunks USING gin(tsv);

-- OrgEntity: HNSW index for entity embedding search
CREATE INDEX idx_org_entities_embedding_hnsw ON org_entities
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);

-- Optimize existing memories HNSW index (better params)
DROP INDEX IF EXISTS memories_embedding_idx;
CREATE INDEX memories_embedding_idx ON memories
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
