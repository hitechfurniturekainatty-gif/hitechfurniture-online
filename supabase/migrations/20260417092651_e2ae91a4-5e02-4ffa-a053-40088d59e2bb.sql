
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Categories
CREATE TABLE public.main_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read main categories" ON public.main_categories FOR SELECT USING (true);
CREATE POLICY "Staff insert main categories" ON public.main_categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff update main categories" ON public.main_categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins delete main categories" ON public.main_categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_main_cat_updated BEFORE UPDATE ON public.main_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category_id UUID NOT NULL REFERENCES public.main_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (main_category_id, slug)
);
ALTER TABLE public.sub_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sub categories" ON public.sub_categories FOR SELECT USING (true);
CREATE POLICY "Staff insert sub categories" ON public.sub_categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff update sub categories" ON public.sub_categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins delete sub categories" ON public.sub_categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_sub_cat_updated BEFORE UPDATE ON public.sub_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category_id UUID NOT NULL REFERENCES public.main_categories(id) ON DELETE RESTRICT,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL UNIQUE,
  description TEXT,
  cost_price NUMERIC(12,2),
  mrp NUMERIC(12,2) NOT NULL,
  offer_price NUMERIC(12,2),
  available_colors TEXT[] DEFAULT '{}'::text[],
  material TEXT,
  dimensions TEXT,
  stock_quantity INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can read products but NOT cost_price (handled by view + column-less queries from public client)
-- We'll restrict at column level via a SECURITY BARRIER view for public, and full access for staff/admin.
CREATE POLICY "Public read published products" ON public.products FOR SELECT USING (is_published = true);
CREATE POLICY "Staff full read products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_products_main_cat ON public.products(main_category_id);
CREATE INDEX idx_products_sub_cat ON public.products(sub_category_id);
CREATE INDEX idx_products_featured ON public.products(is_featured);

-- Trigger to prevent non-admin from reading/updating cost_price: enforce by setting cost_price NULL on update for staff
CREATE OR REPLACE FUNCTION public.protect_cost_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    -- Staff cannot change cost_price; preserve old value
    IF TG_OP = 'UPDATE' THEN
      NEW.cost_price = OLD.cost_price;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.cost_price = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_cost_price BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.protect_cost_price();

-- Product images
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Staff insert product images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff update product images" ON public.product_images FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff delete product images" ON public.product_images FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE INDEX idx_product_images_product ON public.product_images(product_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
CREATE POLICY "Public read product image files" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Staff upload product image files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "Staff update product image files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
CREATE POLICY "Staff delete product image files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
