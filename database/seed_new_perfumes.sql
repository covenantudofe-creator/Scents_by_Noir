-- Adds the perfumes represented by the supplied local product images.
-- Prices and stock counts are provisional; confirm them before taking orders.
-- Safe to re-run: products are matched by the existing unique SKU column.

insert into public.categories (name, slug, description)
values
  ('Floral', 'floral', 'Floral fragrance collection'),
  ('Woody', 'woody', 'Woody fragrance collection'),
  ('Oriental', 'oriental', 'Oriental fragrance collection')
on conflict (slug) do nothing;

update public.products
set
  images = array['/images/perfumes/eclipse-noir.jpg'],
  cover_image = '/images/perfumes/eclipse-noir.jpg',
  size = '50ml',
  updated_at = now()
where name = 'Eclipse Noir'
  and brand = 'Noir Scents';

with new_products (
  sku, name, brand, description, price, image_path, size, category_slug
) as (
  values
    (
      'AFNAN-9PM-100ML',
      '9PM',
      'Afnan',
      'Afnan 9PM Eau de Parfum. The product name and brand are visible on the supplied bottle and packaging.',
      42000,
      '/images/perfumes/AFNAN-9PM-100ML.jpg',
      '100ml',
      'oriental'
    ),
    (
      'AFNAN-9PM-REBEL-100ML',
      '9PM Rebel',
      'Afnan',
      'Afnan 9PM Rebel Eau de Parfum, identified from the supplied group photo of the 9PM collection.',
      45000,
      '/images/perfumes/AFNAN-9PM-REBEL-100ML.jpg',
      '100ml',
      'oriental'
    ),
    (
      'AFNAN-9PM-ELIXIR-100ML',
      '9PM Elixir',
      'Afnan',
      'Afnan 9PM Elixir Eau de Parfum, identified from the supplied group photo of the 9PM collection.',
      48000,
      '/images/perfumes/AFNAN-9PM-ELIXIR-100ML.jpg',
      '100ml',
      'oriental'
    ),
    (
      'LATTAFA-ASAD-100ML',
      'Asad',
      'Lattafa',
      'Lattafa Asad Eau de Parfum, identified from the product name and brand printed on the supplied packaging.',
      38000,
      '/images/perfumes/Asad.jpg',
      '100ml',
      'oriental'
    ),
    (
      'LATTAFA-ASAD-ELIXIR-100ML',
      'Asad Elixir',
      'Lattafa',
      'Lattafa Asad Elixir Eau de Parfum, identified from the product name and brand on the supplied bottle and box.',
      44000,
      '/images/perfumes/asad-elixir.jpg',
      '100ml',
      'oriental'
    ),
    (
      'BARAKKAT-ROUGE-540-100ML',
      'Barakkat Rouge 540',
      'Fragrance World',
      'Barakkat Rouge 540 Extrait de Parfum by Fragrance World, identified from the supplied bottle and packaging.',
      45000,
      '/images/perfumes/barakkat.jpg',
      '100ml',
      'oriental'
    ),
    (
      'CLIVE-DORRIS-ECLAIRE-50ML',
      'Eclaire',
      'Clive Dorris',
      'Clive Dorris Eclaire Eau de Parfum. The name, brand, and 50ml size are visible on the supplied bottle and box.',
      38000,
      '/images/perfumes/esclaire.jpg',
      '50ml',
      'oriental'
    ),
    (
      'FRENCH-AVENUE-LIQUID-BRUN-100ML',
      'Liquid Brun',
      'French Avenue',
      'French Avenue Liquid Brun Eau de Parfum, identified from the product name and brand on the supplied bottle and box.',
      55000,
      '/images/perfumes/french-avenue.jpg',
      '100ml',
      'woody'
    ),
    (
      'LATTAFA-KHAMRAH-100ML',
      'Khamrah',
      'Lattafa',
      'Lattafa Khamrah Eau de Parfum. The name, brand, and 100ml size are visible on the supplied packaging.',
      45000,
      '/images/perfumes/khamrah.jpg',
      '100ml',
      'oriental'
    ),
    (
      'AFNAN-VINTAGE-RADIO-100ML',
      'Vintage Radio',
      'Afnan',
      'Afnan Vintage Radio Eau de Parfum, identified from the product name on the bottle and Afnan branding on its packaging.',
      52000,
      '/images/perfumes/vintage-radio.jpg',
      '100ml',
      'woody'
    ),
    (
      'LATTAFA-YARA-100ML',
      'Yara',
      'Lattafa',
      'Lattafa Yara Eau de Parfum. The product name, brand, and 100ml size are visible on the supplied bottle and box.',
      35000,
      '/images/perfumes/yara.jpg',
      '100ml',
      'floral'
    ),
    (
      'LATTAFA-YARA-CANDY-100ML',
      'Yara Candy',
      'Lattafa',
      'Lattafa Yara Candy Eau de Parfum. The product name, brand, and 100ml size are visible on the supplied packaging.',
      38000,
      '/images/perfumes/yara-candy.jpg',
      '100ml',
      'floral'
    ),
    (
      'EASTLILY-EMBER-30ML',
      'Ember',
      'Eastlily',
      'Eastlily Ember Parfum. The brand, product name, and 30ml size are visible on the supplied bottle.',
      30000,
      '/images/perfumes/ember-crest.jpg',
      '30ml',
      'woody'
    ),
    (
      'OUD-DE-ARABIA',
      'Oud de Arabia',
      'Brand not identified',
      'Oud de Arabia perfume. The product name is legible on the supplied packaging; the maker and size are not identified.',
      35000,
      '/images/perfumes/oud-de-arabia.jpg',
      'Size not shown',
      'oriental'
    )
)
insert into public.products (
  name,
  brand,
  description,
  price,
  images,
  cover_image,
  size,
  fragrance_notes,
  category_id,
  sku,
  stock_quantity,
  active,
  tags
)
select
  new_products.name,
  new_products.brand,
  new_products.description,
  new_products.price,
  array[new_products.image_path],
  new_products.image_path,
  new_products.size,
  '{}',
  categories.id,
  new_products.sku,
  10,
  true,
  array['temporary-price', 'temporary-stock']
from new_products
left join public.categories
  on public.categories.slug = new_products.category_slug
on conflict (sku) do update set
  name = excluded.name,
  brand = excluded.brand,
  description = excluded.description,
  price = excluded.price,
  images = excluded.images,
  cover_image = excluded.cover_image,
  size = excluded.size,
  fragrance_notes = excluded.fragrance_notes,
  category_id = excluded.category_id,
  active = excluded.active,
  tags = excluded.tags,
  updated_at = now();
