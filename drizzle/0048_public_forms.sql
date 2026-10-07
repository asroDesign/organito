-- Public forms and responses are added independently; existing records are untouched.
CREATE TABLE IF NOT EXISTS public_forms (
  id serial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  status text NOT NULL DEFAULT 'draft',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  submit_label text NOT NULL DEFAULT 'ارسال پاسخ',
  success_message text NOT NULL DEFAULT 'پاسخ شما ثبت شد.',
  privacy_notice text,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_forms_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT public_forms_fields_array_check CHECK (jsonb_typeof(fields) = 'array')
);
CREATE INDEX IF NOT EXISTS public_forms_status_updated ON public_forms(status, updated_at);

CREATE TABLE IF NOT EXISTS public_form_submissions (
  id serial PRIMARY KEY,
  form_id integer NOT NULL REFERENCES public_forms(id),
  response_values jsonb NOT NULL,
  schema_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_form_submissions_values_object_check CHECK (jsonb_typeof(response_values) = 'object'),
  CONSTRAINT public_form_submissions_schema_array_check CHECK (jsonb_typeof(schema_snapshot) = 'array')
);
CREATE INDEX IF NOT EXISTS public_form_submissions_form_created ON public_form_submissions(form_id, created_at DESC);
