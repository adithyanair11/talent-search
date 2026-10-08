-- Seed data applied by `npx supabase db reset`.
-- Companies only; recruiters and candidates are seeded by scripts/seed.ts (`npm run seed`).
insert into public.companies (slug, name)
values ('acme', 'Acme'), ('globex', 'Globex')
on conflict (slug) do nothing;
