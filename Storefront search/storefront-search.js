// @ts-check

class StorefrontSearch extends HTMLElement {
  static STORE_NAME = 'developer-12801';
  static DEBOUNCE_DELAY = 500;
  static MATCH_NAME = true;

  /**
   * @typedef {Object} VariantOptionFilter
   * @property {string} name
   * @property {string} value
   */

  /**
   * @typedef {Object} PriceRangeFilter
   * @property {number} [min]
   * @property {number} [max]
   */

  /**
   * @typedef {Object} MetafieldFilter
   * @property {string} namespace
   * @property {string} key
   * @property {string} value
   */

  /**
   * @typedef {Object} TaxonomyMetafieldFilter
   * @property {string} namespace
   * @property {string} key
   * @property {string} value
   */

  /**
   * @typedef {Object} ProductFilter
   * @property {boolean} [available]
   * @property {VariantOptionFilter} [variantOption]
   * @property {string} [productType]
   * @property {string} [productVendor]
   * @property {PriceRangeFilter} [price]
   * @property {MetafieldFilter} [productMetafield]
   * @property {MetafieldFilter} [variantMetafield]
   * @property {string} [tag]
   * @property {TaxonomyMetafieldFilter} [taxonomyMetafield]
   */

  /** @typedef {ProductFilter[]} Filters */

  /**
   * @typedef {Object} ProductSearch
   * @property {string} title
   * @property {string | null} onlineStoreUrl
   * @property {string} handle
   * @property { { url: string | null  } } image
   * @property {Pick<ProductSearch, "title" | "handle" | "onlineStoreUrl">[]} collections
   */

  /**
   * @typedef {Object} SearchResponse
   * @property {ProductSearch[]} products
   * @property {number} totalCount
   */
  constructor() {
    super();

    /** @type {HTMLFormElement | null} */
    this.form = null;

    /** @type {HTMLInputElement | null} */
    this.input = null;

    /** @type {HTMLDivElement | null} */
    this.inner = null;

    /** @type {(event: SubmitEvent) => void} */
    this.boundSubmit = this.onSubmit.bind(this);

    /** @type {(event: Event) => void} */
    this.boundInput = this.debounce((event) => this.onInput.bind(this)(event), StorefrontSearch.DEBOUNCE_DELAY).bind(
      this,
    );

    /** @type {Record<String,SearchResponse>} */
    this.cache = {};
  }

  connectedCallback() {
    this.form = this.querySelector('[data-search-form]');
    this.input = this.querySelector('[data-search-input]');
    this.inner = this.querySelector('[data-search-inner]');

    this.form?.addEventListener('submit', this.boundSubmit);
    this.input?.addEventListener('input', this.boundInput);
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.boundSubmit);
    this.input?.removeEventListener('input', this.boundInput);
  }

  /**
   * @param {SubmitEvent} event
   * @returns {void}
   */
  onSubmit(event) {
    event.preventDefault();
    if (event.target instanceof HTMLFormElement) {
      const formData = new FormData(event.target);
      const query = String(formData.get('query') || '');
      this.buildRequest(query);
    }
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  onInput(event) {
    event.preventDefault();
    this.buildRequest(event.target instanceof HTMLInputElement ? event.target.value : '');
  }

  /**
   * @param {string} query
   * @returns {Promise<void>}
   */
  async buildRequest(query) {
    try {
      const responce = await this.sendRequest(query);
      let { products, totalCount } = responce;
      if (StorefrontSearch.MATCH_NAME) {
        products = products.filter((product) => product.title.toLowerCase().includes(query.toLowerCase()));
      }
      const hasQuery = query.trim().length > 0;
      const createdSearchEntries = !hasQuery
        ? ''
        : products.length
          ? products.map(this.createSearchEntry).join('')
          : this.createEmptyState();
      if (this.inner instanceof HTMLDivElement) {
        this.inner.innerHTML = '';
        this.inner.innerHTML = createdSearchEntries;

        if (hasQuery && products.length && totalCount > products.length) {
          this.inner.append(this.createAllViewButton(totalCount));
        }
      }
    } catch (error) {
      console.log(error);
    }
  }


  /**
   * @param {Omit<ProductSearch, "collections">} searchEntry
   * @returns {string}
   */
  createSearchEntry({ title, handle, onlineStoreUrl, image }) {
    const url = onlineStoreUrl || `${window.location.origin}/products/${handle}`;
    const imageUrl = image?.url;
    const imageMarkup = imageUrl
      ? `<img class="storefront-search__entry-image" width="48" height="48" alt="" loading="lazy" src="${imageUrl}">`
      : '<span class="storefront-search__entry-image storefront-search__entry-image--placeholder" aria-hidden="true"></span>';

    return `
      <a class="storefront-search__entry" href="${url}">
        ${imageMarkup}
        <span class="storefront-search__entry-title">${title}</span>
      </a>
    `;
  }

  /**
   * @param {number} total 
   * @returns {HTMLDivElement}
   */
  createAllViewButton(total) {
    const wrapper = document.createElement('div');
    const link = document.createElement('a');
    const query = this.input?.value.trim() || '';
    const searchUrl = this.getAttribute('data-search-url') || '/search';
    const url = new URL(searchUrl, window.location.origin);

    url.searchParams.set('q', query);
    url.searchParams.set('type', "PRODUCT");

    wrapper.className = 'storefront-search__view-all';
    link.className = 'storefront-search__view-all-link';
    link.href = url.toString();
    const label = this.getAttribute('data-view-all-label') || 'View all';
    link.textContent = `${label} (${total.toLocaleString()})`;

    wrapper.append(link);

    return wrapper;
  }

  /**
   * @returns {string}
   */
  createEmptyState() {
    return `
      <div class="storefront-search__empty-state" role="status">
        <p class="storefront-search__empty-title">No results found</p>
        <p class="storefront-search__empty-text">Try searching for a different product or keyword.</p>
      </div>
    `;
  }

  /**
   * @param {string} query
   * @param {Filters} filters
   * @returns {{ query: string; variables: { query: string; filters: ProductFilter[] } }}
   */
  createQueryBody(query = '', filters = []) {
    return {
      query: `
        query SearchProducts($query: String!, $filters: [ProductFilter!]) {
            search(
                first: 250,
                query: $query,
                types: PRODUCT,
                prefix: NONE,
                productFilters: $filters
            ) {
                products: nodes {
                    ... on Product {
                        title
                        onlineStoreUrl
                        handle
                        image:featuredImage {
                          url
                        }

                        collections(first: 250) {
                            collections: nodes {
                                title
                                onlineStoreUrl
                                handle
                            }
                        }
                    }
                }
                totalCount
            }
        }
    `,
      variables: {
        query: query,
        filters: [...filters],
      },
    };
  }

  /**
   * @param {string} query
   * @param {Filters} filters
   * @returns {Promise<SearchResponse>}
   */
  async sendRequest(query = '', filters = []) {
    /** @type {SearchResponse} */
    let result = {
      products: [],
      totalCount: 0,
    };

    if (!query) {
      return new Promise((resolve) => resolve(result));
    }

    if (this.cache[query]) {
      return new Promise((resolve) => resolve(this.cache[query]));
    }

    const requestConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.createQueryBody(query, filters)),
    };

    try {
      const response = await fetch(
        `https://${StorefrontSearch.STORE_NAME}.myshopify.com/api/2026-07/graphql.json`,
        requestConfig,
      );
      /** @type { {data: {search: SearchResponse }} } */
      const {
        data: { search },
      } = await response.json();

      result = { ...search };
    } catch (error) {
      console.log(error);
    }

    this.cache[query] = result;

    return result;
  }

  /**
   * @param {(e: Event) => void} fn
   * @param {number} wait
   * @returns {(e: Event) => void}
   */
  debounce(fn, wait) {
    /** @type {ReturnType<typeof setTimeout>} */
    let t;

    return (e) => {
      clearTimeout(t);
      t = setTimeout(() => fn.call(this, e), wait);
    };
  }
}

if (!customElements.get('storefront-search')) {
  customElements.define('storefront-search', StorefrontSearch);
}
