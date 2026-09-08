-- The signed attachment client and private-media function accompany this rollout.
UPDATE storage.buckets SET public=false WHERE id='quotations';
