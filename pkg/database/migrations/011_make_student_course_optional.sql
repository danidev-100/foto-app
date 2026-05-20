-- Allow students to register without a course initially.
-- course_id can be set later or remains null.

ALTER TABLE students ALTER COLUMN course_id DROP NOT NULL;
