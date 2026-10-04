import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase, supabaseConfigError } from './lib/supabase';

const currency = (value) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
}).format(value || 0);

const getStoredCart = () => {
  try {
    return JSON.parse(localStorage.getItem('noir-cart') || '[]');
  } catch {
    return [];
  }
};

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(getStoredCart);
  const [toast, setToast] = useState('');
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authInitError, setAuthInitError] = useState('');
  const [profileRole, setProfileRole] = useState('customer');

  useEffect(() => {
    localStorage.setItem('noir-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.removeItem('noir-user');
    localStorage.removeItem('noir-token');
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return undefined;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setAuthInitError('');
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Supabase session could not be restored', error);
          setAuthInitError('We could not restore your sign-in session. Please sign in again.');
          setSession(null);
        } else {
          setSession(data.session);
        }
        setAuthReady(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Supabase session initialization failed', error);
        setAuthInitError('We could not connect to authentication. Please try again.');
        setSession(null);
        setAuthReady(true);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user || null;

  useEffect(() => {
    if (!supabase || !user) {
      setProfileRole('customer');
      return undefined;
    }

    setProfileRole('customer');
    let active = true;
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('User profile could not be loaded', error);
          setProfileRole('customer');
          return;
        }
        setProfileRole(data?.role || 'customer');
      })
      .catch((error) => {
        if (!active) return;
        console.error('User profile request failed', error);
        setProfileRole('customer');
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const signOut = async () => {
    if (!supabase) {
      setAuthInitError(supabaseConfigError);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAuthInitError('');
    } catch (error) {
      console.error('Supabase sign-out failed', error);
      setAuthInitError('We could not sign you out. Please try again.');
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch('/api/products', { signal: controller.signal }),
      fetch('/api/categories', { signal: controller.signal }),
    ])
      .then(async ([productsResponse, categoriesResponse]) => {
        const [productData, categoryData] = await Promise.all([
          productsResponse.json(),
          categoriesResponse.json(),
        ]);
        setProducts(productData);
        setCategories(categoryData);
        setCart((current) => current.map((item) => {
          const currentProduct = productData.find((product) => product.id === item.id || product.slug === item.slug);
          return currentProduct
            ? { ...item, image: currentProduct.image, gallery: currentProduct.gallery }
            : item;
        }));
      })
      .catch(() => {
        setProducts([]);
        setCategories([]);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  const addToCart = (product, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock || 99) }
          : item);
      }
      return [...current, { ...product, quantity }];
    });
    setToast(`${product.name} added to cart.`);
  };

  const updateCartItem = (productId, quantity) => {
    setCart((current) => current
      .map((item) => (item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item))
      .filter((item) => item.quantity > 0));
  };

  const removeCartItem = (productId) => {
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const shippingFee = subtotal > 225000 ? 0 : 15000;
  const total = subtotal + shippingFee;

  return (
    <BrowserRouter>
      <div className="page-shell">
        <Header cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} user={user} onSignOut={signOut} />
        <main>
          <Routes>
            <Route path="/" element={<HomePage categories={categories} products={products} addToCart={addToCart} />} />
            <Route path="/shop" element={<ShopPage categories={categories} products={products} addToCart={addToCart} />} />
            <Route path="/product/:productId" element={<ProductPage addToCart={addToCart} products={products} />} />
            <Route path="/cart" element={<CartPage cart={cart} updateCartItem={updateCartItem} removeCartItem={removeCartItem} subtotal={subtotal} shippingFee={shippingFee} total={total} />} />
            <Route path="/checkout" element={<CheckoutPage cart={cart} subtotal={subtotal} shippingFee={shippingFee} total={total} setCart={setCart} />} />
            <Route path="/account" element={<AccountPage user={user} profileRole={profileRole} authReady={authReady} authInitError={authInitError} />} />
            <Route path="/success" element={<OrderSuccessPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/admin" element={<AdminPage user={user} profileRole={profileRole} session={session} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
        {toast && <div className="toast">{toast}</div>}
      </div>
    </BrowserRouter>
  );
}

function Header({ cartCount, user, onSignOut }) {
  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/contact', label: 'Contact' },
    { to: '/faq', label: 'FAQ' },
    { to: '/admin', label: 'Admin' },
  ];

  return (
    <header className="site-header">
      <div className="container nav-row">
        <Link className="brand" to="/">
          <span className="brand-mark">N</span>
          <span>Noir Scents</span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <Link to="/account" className="pill-link">
            {user ? user.user_metadata?.full_name || user.user_metadata?.name || user.email : 'Account'}
          </Link>
          <Link to="/cart" className="cart-button" aria-label="View shopping cart">
            Cart <span>{cartCount}</span>
          </Link>
          {user && (
            <button type="button" className="ghost-button" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function HomePage({ products, categories, addToCart }) {
  const featuredPool = products.filter((product) => product.featured).slice(0, 4);
  const heroProduct = featuredPool[0] || products[0];

  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Crafted in Nigeria</p>
            <h1>Perfume that lingers in memory.</h1>
            <p>
              Discover luxurious scents designed for warm evenings, elegant gifting, and everyday confidence.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" to="/shop">Shop collection</Link>
              <Link className="secondary-button" to="/contact">Book a fragrance consultation</Link>
            </div>
            <ul className="hero-metrics" aria-label="Brand statistics">
              <li><strong>12k+</strong><span>Happy customers</span></li>
              <li><strong>4.9/5</strong><span>Average rating</span></li>
              <li><strong>48h</strong><span>Dispatch window</span></li>
            </ul>
          </div>
          <div className="hero-visual">
            <div className="hero-card glow-card">
              {heroProduct ? (
                <>
                  <ProductImage
                    key={heroProduct.image || heroProduct.name}
                    src={heroProduct.image}
                    productName={heroProduct.name}
                    className="hero-product-image"
                    loading="eager"
                  />
                  <div className="hero-badge">
                    <span>Featured perfume</span>
                    <strong>{heroProduct.name}</strong>
                  </div>
                </>
              ) : (
                <div className="hero-loading">Loading fragrance collection…</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Shop by mood</p>
            <h2>From floral to woody.</h2>
          </div>
          <div className="category-grid">
            {categories.slice(0, 5).map((category) => (
              <div key={category.id} className="category-card">
                <span className="category-icon">✦</span>
                <h3>{category.name}</h3>
                <small>Curated luxury blends</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block alt-block">
        <div className="container">
          <div className="section-heading row-heading">
            <div>
              <p className="eyebrow">Featured scents</p>
              <h2>Best sellers this month</h2>
            </div>
            <Link to="/shop" className="text-link">View all</Link>
          </div>
          <div className="product-grid">
            {featuredPool.map((product) => (
              <ProductCard key={product.id} product={product} addToCart={addToCart} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container testimonial-wrap">
          <div className="section-heading">
            <p className="eyebrow">Loved by customers</p>
            <h2>What they say</h2>
          </div>
          <div className="testimonial-grid">
            {[
              'Noir Scents feels premium and authentic. The packaging is luxurious and the fragrances last all day.',
              'The service was seamless and the scent was richly layered. It feels like a special-occasion perfume.',
              'I ordered for a gift and it arrived beautifully presented. The fragrance notes were exactly as described.',
            ].map((quote, index) => (
              <article key={index} className="testimonial-card">
                <div className="stars">★★★★★</div>
                <p>“{quote}”</p>
                <h4>Verified customer</h4>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block newsletter-block">
        <div className="container newsletter-box">
          <div>
            <p className="eyebrow">Stay in the loop</p>
            <h2>Get early access to launches and gift offers.</h2>
          </div>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}

function ShopPage({ categories, products, addToCart }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('popularity');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [items, setItems] = useState(products);

  useEffect(() => {
    const params = new URLSearchParams({
      q: query,
      category,
      brand,
      minPrice,
      maxPrice,
      sort,
    });

    fetch(`/api/products?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, [query, category, brand, minPrice, maxPrice, sort, products]);

  const brands = [...new Set(products.map((product) => product.brand))];

  return (
    <div className="container page-padding">
      <div className="page-header">
        <div>
          <p className="eyebrow">Exquisite finds</p>
          <h1>Shop fragrance collections</h1>
        </div>
      </div>

      <div className="shop-layout">
        <aside className="filter-panel">
          <h3>Filters</h3>
          <label>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search perfumes" />
          </label>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Brand
            <select value={brand} onChange={(event) => setBrand(event.target.value)}>
              <option value="">All brands</option>
              {brands.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="price-row">
            <label>
              Min ₦
              <input type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
            </label>
            <label>
              Max ₦
              <input type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
            </label>
          </div>
          <label>
            Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="popularity">Popularity</option>
              <option value="newest">Newest</option>
              <option value="priceAsc">Price: low to high</option>
              <option value="priceDesc">Price: high to low</option>
            </select>
          </label>
        </aside>

        <div className="shop-results">
          <div className="result-info">
            <strong>{items.length}</strong> perfumes available
          </div>
          <div className="product-grid">
            {items.length ? items.map((product) => (
              <ProductCard key={product.id} product={product} addToCart={addToCart} />
            )) : <div className="empty-state">No perfumes match your filters.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductPage({ products, addToCart }) {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const found = products.find((item) => item.id === productId || item.slug === productId);
    if (found) {
      setProduct(found);
      return;
    }

    fetch(`/api/products/${productId}`)
      .then((response) => response.json())
      .then((data) => setProduct(data))
      .catch(() => setProduct(null));
  }, [productId, products]);

  if (!product) return <div className="container page-padding"><div className="empty-state">Product not found.</div></div>;

  return (
    <div className="container page-padding product-page">
      <div className="product-gallery">
        <ProductImage
          key={product.image || product.name}
          src={product.image}
          productName={product.name}
          className="main-image"
        />
        <div className="thumbnail-row">
          {(product.gallery || []).map((image, index) => (
            <ProductImage
              key={`${product.id}-${index}-${image}`}
              src={image}
              productName={`${product.name}, view ${index + 1}`}
              className="product-thumbnail"
            />
          ))}
        </div>
      </div>

      <div className="product-summary">
        <p className="eyebrow">{product.brand}</p>
        <h1>{product.name}</h1>
        <p className="product-price">{currency(product.price)}</p>
        {(product.priceIsTemporary || product.stockIsTemporary) && (
          <p className="provisional-product-note">
            {product.priceIsTemporary && 'Temporary price — confirm before selling.'}
            {product.priceIsTemporary && product.stockIsTemporary && ' '}
            {product.stockIsTemporary && 'Temporary stock estimate — update before selling.'}
          </p>
        )}
        <p className="product-description">{product.description}</p>

        <div className="detail-list">
          <div><span>Size</span><strong>{product.size}</strong></div>
          <div><span>Fragrance type</span><strong>{product.fragranceType}</strong></div>
          <div>
            <span>Stock</span>
            <strong>
              {product.stock > 0
                ? `${product.stock}${product.stockIsTemporary ? ' estimated' : ' available'}`
                : 'Out of stock'}
            </strong>
          </div>
        </div>

        <div className="purchase-row">
          <label className="quantity-control">
            Qty
            <input type="number" min="1" max={product.stock || 10} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
          </label>
          <button type="button" className="primary-button" onClick={() => addToCart(product, quantity)}>
            Add to cart
          </button>
        </div>

        <div className="notes-box">
          <h3>Fragrance notes</h3>
          <div className="note-tags">
            {(product.notes || []).map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="related-products">
        <div className="section-heading">
          <p className="eyebrow">You may also like</p>
          <h2>Related fragrances</h2>
        </div>
        <div className="product-grid">
          {(product.related || []).slice(0, 4).map((relatedProduct) => (
            <ProductCard key={relatedProduct.id} product={relatedProduct} addToCart={addToCart} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CartPage({ cart, updateCartItem, removeCartItem, subtotal, shippingFee, total }) {
  const navigate = useNavigate();

  if (!cart.length) {
    return (
      <div className="container page-padding centered-block">
        <div className="empty-state">
          <h2>Your cart is empty.</h2>
          <Link className="primary-button" to="/shop">Continue shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-padding cart-page">
      <div className="page-header">
        <p className="eyebrow">Cart</p>
        <h1>Review your order</h1>
      </div>

      <div className="cart-layout">
        <div className="cart-list">
          {cart.map((item) => (
            <article key={item.id} className="cart-item">
              <ProductImage src={item.image} productName={item.name} className="cart-product-image" />
              <div className="cart-item-info">
                <h3>{item.name}</h3>
                <p>{currency(item.price)} each</p>
                {item.priceIsTemporary && <small className="provisional-product-note">Temporary price</small>}
              </div>
              <div className="cart-controls">
                <button type="button" onClick={() => updateCartItem(item.id, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => updateCartItem(item.id, item.quantity + 1)}>+</button>
              </div>
              <strong>{currency(item.price * item.quantity)}</strong>
              <button type="button" className="remove-button" onClick={() => removeCartItem(item.id)}>Remove</button>
            </article>
          ))}
        </div>

        <aside className="summary-box">
          <h3>Order summary</h3>
          <div className="summary-row"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
          <div className="summary-row"><span>Delivery</span><strong>{currency(shippingFee)}</strong></div>
          <div className="summary-row total"><span>Total</span><strong>{currency(total)}</strong></div>
          <button type="button" className="primary-button w-full" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
        </aside>
      </div>
    </div>
  );
}

function CheckoutPage({ cart, subtotal, shippingFee, total, setCart }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    state: 'Lagos',
    city: 'Ikeja',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = payload.errors?.[0]?.msg || payload.message || 'Unable to place order.';
        throw new Error(message);
      }

      setCart([]);
      navigate('/success', { state: { order: payload.order } });
    } catch (submitError) {
      setError(submitError.message || 'Unable to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container page-padding checkout-page">
      <div className="page-header">
        <p className="eyebrow">Checkout</p>
        <h1>Deliver to your doorstep</h1>
      </div>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Customer details</legend>
            <div className="field-grid">
              <label>Full name<input required value={form.name} onChange={handleChange('name')} /></label>
              <label>Email<input type="email" required value={form.email} onChange={handleChange('email')} /></label>
              <label>Phone<input required value={form.phone} onChange={handleChange('phone')} /></label>
              <label>State<select value={form.state} onChange={handleChange('state')}>
                <option value="Lagos">Lagos</option>
                <option value="Fct">Fct</option>
                <option value="Rivers">Rivers</option>
                <option value="Kano">Kano</option>
                <option value="Ogun">Ogun</option>
                <option value="Ondo">Ondo</option>
                <option value="Benue">Benue</option>
                <option value="Abia">Abia</option>
                <option value="Sokoto">Sokoto</option>
                <option value="Niger">Niger</option>
                <option value="Imo">Imo</option>
                <option value="Kwara">Kwara</option>
                <option value="Kaduna">Kaduna</option>
                <option value="Akwa Ibom">Akwa Ibom</option>
                <option value="Enugu">Enugu</option>
              </select></label>
              <label>City<input required value={form.city} onChange={handleChange('city')} /></label>
              <label className="wide-field">Delivery address<textarea required rows="4" value={form.address} onChange={handleChange('address')} /></label>
            </div>
          </fieldset>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Processing...' : 'Place order'}</button>
        </form>

        <aside className="summary-box">
          <h3>Order summary</h3>
          {cart.map((item) => (
            <div key={item.id} className="mini-order-row">
              <div className="mini-order-product">
                <ProductImage src={item.image} productName={item.name} className="checkout-product-image" />
                <span>
                  {item.name} x {item.quantity}
                  {item.priceIsTemporary && <small className="provisional-product-note">Temporary price</small>}
                </span>
              </div>
              <strong>{currency(item.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-row"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
          <div className="summary-row"><span>Shipping</span><strong>{currency(shippingFee)}</strong></div>
          <div className="summary-row total"><span>Total</span><strong>{currency(total)}</strong></div>
        </aside>
      </div>
    </div>
  );
}

function OrderSuccessPage() {
  const location = useLocation();
  const order = location.state?.order || null;

  return (
    <div className="container page-padding centered-block">
      <div className="success-box">
        <p className="eyebrow">Thank you</p>
        <h1>Order placed successfully.</h1>
        <p>Your perfume order is confirmed and our team will contact you shortly.</p>
        {order ? (
          <div className="success-meta">
            <span>Order reference</span>
            <strong>{order.orderReference}</strong>
            <span>Total paid</span>
            <strong>{currency(order.total)}</strong>
          </div>
        ) : null}
        <Link className="primary-button" to="/shop">Continue shopping</Link>
      </div>
    </div>
  );
}

function authErrorMessage(error, action) {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Please confirm your email address before signing in.';
  if (message.includes('user already registered')) return 'An account with this email already exists. Try signing in.';
  if (message.includes('password should be at least')) return 'Choose a password with at least 6 characters.';
  if (action === 'register') return 'We could not create your account. Check your details and try again.';
  return 'We could not sign you in. Check your details and try again.';
}

function clearGoogleSignInAttempt() {
  try {
    window.sessionStorage.removeItem('noir-google-oauth-pending');
  } catch (error) {
    console.warn('Could not clear the Google sign-in status', error);
  }
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.72 5.99c4.51-4.17 7.1-10.32 7.1-17.64Z" transform="translate(0 0)" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.99 23.99 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 4)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.72-5.99c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)" />
    </svg>
  );
}

function AccountPage({ user, profileRole, authReady, authInitError }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');

  useEffect(() => {
    const queryError = new URLSearchParams(location.search).get('error');
    const hashError = new URLSearchParams(location.hash.replace(/^#/, '')).get('error');
    if (queryError || hashError) {
      clearGoogleSignInAttempt();
      setError('Google sign-in was unsuccessful. Please try again.');
      navigate('/account', { replace: true });
      return;
    }

    let hadPendingGoogleSignIn = false;
    try {
      hadPendingGoogleSignIn = window.sessionStorage.getItem('noir-google-oauth-pending') === 'true';
    } catch (storageError) {
      console.warn('Could not read the Google sign-in status', storageError);
    }

    if (user) {
      clearGoogleSignInAttempt();
    } else if (authReady && hadPendingGoogleSignIn) {
      clearGoogleSignInAttempt();
      setError('Google sign-in was unsuccessful. Please try again.');
    }
  }, [authReady, location.hash, location.search, navigate, user]);

  useEffect(() => {
    if (!user || !supabase) {
      setOrders([]);
      setOrdersError('');
      return undefined;
    }

    let active = true;
    supabase.from('orders')
      .select('id, order_reference, total, order_status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          console.error('Order history could not be loaded', queryError);
          setOrdersError('We could not load your order history right now.');
          return;
        }
        setOrders(data || []);
        setOrdersError('');
      })
      .catch((queryError) => {
        if (!active) return;
        console.error('Order history request failed', queryError);
        setOrdersError('We could not load your order history right now.');
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }

    setBusy(true);
    try {
      if (view === 'register') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { full_name: form.name.trim() },
            emailRedirectTo: `${window.location.origin}/account`,
          },
        });

        if (authError) {
          setError(authErrorMessage(authError, 'register'));
        } else if (data.session) {
          setNotice('Your account has been created and you are signed in.');
        } else {
          setNotice('Your account has been created. Check your email to confirm your address, then sign in.');
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });

        if (authError) {
          setError(authErrorMessage(authError, 'login'));
        }
      }
    } catch (authError) {
      console.error('Supabase email authentication failed', authError);
      setError(authErrorMessage(authError, view));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setNotice('');
    if (!supabase) {
      setError(supabaseConfigError);
      return;
    }

    setGoogleBusy(true);
    try {
      window.sessionStorage.setItem('noir-google-oauth-pending', 'true');
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/account` },
      });

      if (authError) {
        clearGoogleSignInAttempt();
        console.error('Supabase Google sign-in failed', authError);
        setError('Google sign-in was unsuccessful. Please try again.');
        setGoogleBusy(false);
      }
    } catch (authError) {
      clearGoogleSignInAttempt();
      console.error('Could not start Google sign-in', authError);
      setError('Google sign-in was unsuccessful. Please try again.');
      setGoogleBusy(false);
    }
  };

  if (!authReady) {
    return <div className="container page-padding centered-block"><div className="empty-state">Checking your sign-in session…</div></div>;
  }

  if (user) {
    const metadata = user.user_metadata || {};
    const name = metadata.full_name || metadata.name || user.email || 'Customer';
    const avatar = metadata.avatar_url || metadata.picture;

    return (
      <div className="container page-padding account-page">
        <div className="page-header">
          <p className="eyebrow">My account</p>
          <h1>Welcome back, {name}</h1>
        </div>

        <div className="account-grid">
          <section className="info-card profile-card">
            {avatar && <img className="profile-avatar" src={avatar} alt={`${name} profile`} referrerPolicy="no-referrer" />}
            <h3>Profile</h3>
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {profileRole}</p>
          </section>

          <section className="info-card">
            <h3>Order history</h3>
            {ordersError && <div className="error-banner">{ordersError}</div>}
            {orders.length ? orders.map((order) => (
              <div key={order.id} className="order-row">
                <div>
                  <strong>{order.order_reference}</strong>
                  <small>{new Date(order.created_at).toLocaleDateString()} · {order.order_status}</small>
                </div>
                <span>{currency(order.total)}</span>
              </div>
            )) : !ordersError && <p>No orders yet.</p>}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-padding account-page auth-page">
      <div className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={view === 'login' ? 'active' : ''} onClick={() => { setView('login'); setError(''); setNotice(''); }}>Sign in</button>
          <button type="button" className={view === 'register' ? 'active' : ''} onClick={() => { setView('register'); setError(''); setNotice(''); }}>Sign up</button>
        </div>

        {authInitError && <div className="error-banner">{authInitError}</div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {notice && <div className="success-banner" role="status">{notice}</div>}

        <form onSubmit={handleEmailAuth}>
          {view === 'register' && (
            <label>
              Full name
              <input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          )}

          <label>
            Email
            <input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input type="password" autoComplete={view === 'login' ? 'current-password' : 'new-password'} minLength="6" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>

          <button type="submit" className="primary-button w-full" disabled={busy || googleBusy}>
            {busy ? 'Please wait…' : view === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <button type="button" className="google-button w-full" onClick={handleGoogleSignIn} disabled={busy || googleBusy}>
          <GoogleIcon />
          <span>{googleBusy ? 'Connecting to Google…' : 'Continue with Google'}</span>
        </button>
      </div>
    </div>
  );
}

function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      setSubmitted(true);
      setForm({ name: '', email: '', message: '' });
    }
  };

  return (
    <div className="container page-padding contact-page">
      <div className="page-header">
        <p className="eyebrow">Customer care</p>
        <h1>Contact our fragrance experts</h1>
      </div>

      <div className="contact-layout">
        <form className="contact-form" onSubmit={handleSubmit}>
          <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Message<textarea rows="5" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
          <button type="submit" className="primary-button">Send message</button>
          {submitted && <div className="success-banner">Your message has been received.</div>}
        </form>

        <aside className="info-card contact-info">
          <h3>Reach us</h3>
          <p>Email: hello@noirscents.com</p>
          <p>Phone: +234 800 000 1234</p>
          <p>Address: 15 Admiralty Way, Lekki Phase 1, Lagos</p>
        </aside>
      </div>
    </div>
  );
}

function FaqPage() {
  const faqs = [
    { q: 'How long does shipping take?', a: 'Most orders are delivered within 2-5 business days across Nigeria.' },
    { q: 'Do you offer gift packaging?', a: 'Yes, all premium orders can be wrapped in our luxury gift presentation.' },
    { q: 'Can I return or exchange a product?', a: 'Unused items can be returned within 7 days if they are in their original condition.' },
    { q: 'Do you stock unisex fragrances?', a: 'Absolutely. Our collection includes unisex scents alongside signature feminine and masculine fragrances.' },
  ];

  return (
    <div className="container page-padding faq-page">
      <div className="page-header">
        <p className="eyebrow">Support</p>
        <h1>Frequently asked questions</h1>
      </div>
      <div className="faq-list">
        {faqs.map((item) => (
          <article key={item.q} className="faq-item">
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function PoliciesPage() {
  return (
    <div className="container page-padding policy-page">
      <div className="page-header">
        <p className="eyebrow">Policies</p>
        <h1>Our commitment to customers</h1>
      </div>
      <div className="policy-grid">
        <article className="info-card">
          <h3>Delivery policy</h3>
          <p>We deliver across Nigeria using trusted fulfilment partners and provide tracking updates where available.</p>
        </article>
        <article className="info-card">
          <h3>Refund policy</h3>
          <p>Refunds may be offered for damaged or incorrect items reported within 48 hours of delivery.</p>
        </article>
        <article className="info-card">
          <h3>Privacy policy</h3>
          <p>We process customer data only for order fulfilment, account management, and support communication.</p>
        </article>
      </div>
    </div>
  );
}

function AdminPage({ user, profileRole, session }) {
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  useEffect(() => {
    if (!user || profileRole !== 'admin' || !session?.access_token) return undefined;
    let active = true;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Could not load admin statistics.');
        return payload;
      })
      .then((payload) => {
        if (active) {
          setStats(payload);
          setStatsError('');
        }
      })
      .catch((error) => {
        if (!active) return;
        console.error('Admin statistics could not be loaded', error);
        setStatsError('Admin statistics are unavailable right now.');
      });
    return () => {
      active = false;
    };
  }, [user?.id, profileRole, session?.access_token]);

  if (!user || profileRole !== 'admin') {
    return (
      <div className="container page-padding centered-block">
        <div className="empty-state">
          <h2>Admin access required.</h2>
          <p>Only authorised personnel can manage products, inventory, and orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-padding admin-page">
      <div className="page-header">
        <p className="eyebrow">Admin dashboard</p>
        <h1>Operations overview</h1>
      </div>

      {statsError && <div className="error-banner" role="alert">{statsError}</div>}
      <div className="stats-grid">
        <article className="info-card">
          <h3>Total orders</h3>
          <strong>{stats?.totalOrders ?? 0}</strong>
        </article>
        <article className="info-card">
          <h3>Revenue</h3>
          <strong>{currency(stats?.totalRevenue ?? 0)}</strong>
        </article>
        <article className="info-card">
          <h3>Average order</h3>
          <strong>{currency(stats?.averageOrder ?? 0)}</strong>
        </article>
        <article className="info-card">
          <h3>Low stock alerts</h3>
          <strong>{stats?.lowStockItems ?? 0}</strong>
        </article>
      </div>

      <div className="admin-actions">
        <Link className="primary-button" to="/shop">Manage catalog</Link>
        <Link className="secondary-button" to="/contact">Review inquiries</Link>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="container page-padding centered-block">
      <div className="empty-state">
        <h1>Page not found.</h1>
        <Link className="primary-button" to="/">Back home</Link>
      </div>
    </div>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    setMessage(response.ok ? payload.message : payload.errors?.[0]?.msg || 'Unable to subscribe.');
    if (response.ok) setEmail('');
  };

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <input type="email" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <button type="submit" className="primary-button">Subscribe</button>
      {message && <small>{message}</small>}
    </form>
  );
}

function ProductCard({ product, addToCart }) {
  return (
    <article className="product-card">
      <Link to={`/product/${product.slug || product.id}`} className="product-image-link">
        <ProductImage src={product.image} productName={product.name} />
      </Link>
      <div className="product-details">
        <div className="product-meta">
          <span>{product.brand}</span>
          <span>{product.size}</span>
        </div>
        <Link to={`/product/${product.slug || product.id}`} className="product-name-link">
          <h3>{product.name}</h3>
        </Link>
        <p>{product.description}</p>
        <div className="product-bottom-row">
          <div>
            <strong>{currency(product.price)}</strong>
            {(product.priceIsTemporary || product.stockIsTemporary) && (
              <small className="provisional-product-note">Temporary price / stock</small>
            )}
          </div>
          <button type="button" className="primary-button" onClick={() => addToCart(product, 1)}>Add</button>
        </div>
      </div>
    </article>
  );
}

function ProductImage({ src, productName, className = '', loading = 'lazy' }) {
  const [unavailable, setUnavailable] = useState(!src);
  const alt = `${productName} perfume bottle`;
  const imageClassName = `product-image ${className}`.trim();

  useEffect(() => {
    setUnavailable(!src);
  }, [src]);

  if (!src || unavailable) {
    return (
      <div className={`image-unavailable ${imageClassName}`} role="img" aria-label={`${alt}; image unavailable`}>
        <span className="image-unavailable-icon" aria-hidden="true">◇</span>
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      className={imageClassName}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setUnavailable(true)}
    />
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h3>Noir Scents</h3>
          <p>Luxury fragrances with a Nigerian soul.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <Link to="/shop">Shop</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/policies">Policies</Link>
        </div>
        <div>
          <h4>Company</h4>
          <Link to="/contact">Contact</Link>
          <Link to="/account">Account</Link>
          <Link to="/admin">Admin</Link>
        </div>
        <div>
          <h4>Support</h4>
          <a href="mailto:hello@noirscents.com">hello@noirscents.com</a>
          <a href="tel:+2348000001234">+234 800 000 1234</a>
          <span>Lagos • Abuja • Port Harcourt</span>
        </div>
      </div>
    </footer>
  );
}

export default App;
