CREATE INDEX "Job_title_fts_idx" ON "Job" USING GIN (to_tsvector('simple', "title"));
CREATE INDEX "Job_description_fts_idx" ON "Job" USING GIN (to_tsvector('simple', "description"));
CREATE INDEX "Job_category_fts_idx" ON "Job" USING GIN (to_tsvector('simple', "category"));
CREATE INDEX "Company_name_fts_idx" ON "Company" USING GIN (to_tsvector('simple', "name"));
