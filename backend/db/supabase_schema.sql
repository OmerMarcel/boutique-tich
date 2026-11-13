-- ==============================================================================
-- ✦ TICH ATELIER — SCHÉMA SUPABASE POSTGRESQL ✦
-- Copiez et collez ce script dans : Supabase > SQL Editor > New Query > Run
-- ==============================================================================

-- 1. Supprimer et recréer proprement la table des produits
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- 2. Table des Produits
-- Colonnes en minuscules (standard PostgreSQL, pas de camelCase)
CREATE TABLE public.products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  subcategory  TEXT NOT NULL DEFAULT '',
  price        INTEGER NOT NULL DEFAULT 0,
  type         TEXT NOT NULL DEFAULT '',
  image        TEXT NOT NULL DEFAULT '',
  tag          TEXT NOT NULL DEFAULT '',
  rating       NUMERIC NOT NULL DEFAULT 5.0,
  description  TEXT NOT NULL DEFAULT '',
  options      JSONB NOT NULL DEFAULT '[]'::jsonb,
  details      TEXT NOT NULL DEFAULT '',
  stock        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Table des Paramètres
CREATE TABLE public.settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 4. Sécurité au niveau des lignes (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Nettoie les anciennes politiques
DROP POLICY IF EXISTS "Lecture publique des produits" ON public.products;
DROP POLICY IF EXISTS "Accès complet service backend" ON public.products;
DROP POLICY IF EXISTS "Accès complet settings service" ON public.settings;

-- Lecture publique (clients non connectés)
CREATE POLICY "Lecture publique des produits"
  ON public.products FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- Accès complet pour l'API backend (admin)
CREATE POLICY "Accès complet service backend"
  ON public.products FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Accès complet settings service"
  ON public.settings FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 5. Bucket de Stockage pour les Photos de Produits (Supabase Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lecture publique du bucket products" ON storage.objects;
DROP POLICY IF EXISTS "Upload dans le bucket products" ON storage.objects;

CREATE POLICY "Lecture publique du bucket products"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

CREATE POLICY "Upload dans le bucket products"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'products');
