-- Public read for product images
create policy "Public read product images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
);

-- MVP upload policy for product images
create policy "Allow product image uploads"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'product-images'
);
