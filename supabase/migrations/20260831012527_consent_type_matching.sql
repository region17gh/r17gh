-- Matching is a processing purpose in its own right under Act 843 and GDPR:
-- a member consenting to be matched is consenting to be reached. It was the one
-- purpose missing from the vocabulary.
alter type public.consent_type add value if not exists 'matching';
