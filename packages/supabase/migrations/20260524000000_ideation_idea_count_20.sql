-- Allow up to 20 ideas per run for Enterprise tier
alter table public.ideation_jobs
  drop constraint if exists ideation_jobs_idea_count_check;

alter table public.ideation_jobs
  add constraint ideation_jobs_idea_count_check check (idea_count between 1 and 20);
