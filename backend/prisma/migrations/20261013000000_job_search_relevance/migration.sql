CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Job_title_trgm_idx" ON "Job" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Job_description_trgm_idx" ON "Job" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Job_category_trgm_idx" ON "Job" USING GIN ("category" gin_trgm_ops);
CREATE INDEX "Company_name_trgm_idx" ON "Company" USING GIN ("name" gin_trgm_ops);
