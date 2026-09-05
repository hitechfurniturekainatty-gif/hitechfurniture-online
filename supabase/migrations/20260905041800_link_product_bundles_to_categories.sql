alter table public.product_bundles
  add constraint product_bundles_main_category_id_fkey
  foreign key (main_category_id) references public.main_categories(id);

alter table public.product_bundles
  add constraint product_bundles_sub_category_id_fkey
  foreign key (sub_category_id) references public.sub_categories(id);
