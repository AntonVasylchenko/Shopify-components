// @ts-check

class ToastUI extends HTMLElement {
  /**
   *  @typedef {Object} ToastDetail
   *  @property {string} id
   */

  /** @typedef {CustomEvent<ToastDetail>} CustomToastEvent */

  /** @type {Map<String, ToastUI>} */
  static instancesById = new Map();
  static DISPLAY_DURATION = 3_000;

  constructor() {
    super();

    /** @type {HTMLTemplateElement | null} */
    this.contentTemplate = null;

    /** @type {String | null} */
    this.toastIdentifier = null;

    /** @type {ReturnType<typeof setTimeout>} */
    this.hideTimeout;

    /** @type { (event: Event ) => void } */
    this.handleToastCall = this.handleToastCall.bind(this);
  }

  connectedCallback() {
    this.contentTemplate = this.querySelector('[data-toast-content]');
    this.mountContent();
    this.toastIdentifier = this.dataset.toastId || null;
    if (this.toastIdentifier) this.updateInstanceRegistry(this.toastIdentifier, 'set');

    document.addEventListener('toast:call', this.handleToastCall);
  }

  disconnectedCallback() {
    if (this.toastIdentifier) this.updateInstanceRegistry(this.toastIdentifier, 'delete');
    document.removeEventListener('toast:call', this.handleToastCall);
  }

  /**
   * @returns {void}
   */
  mountContent() {
    if (!(this.contentTemplate instanceof HTMLTemplateElement)) return;
    if (this.querySelector('.toast-ui__content')) return;

    this.append(this.contentTemplate.content.cloneNode(true));
  }

  /**
   * @param {string} id
   * @param {"set" | "delete"} type
   * @returns {void}
   */
  updateInstanceRegistry(id, type) {
    const hasInstance = this.hasInstance(id);

    if (type === 'set' && !hasInstance) {
      ToastUI.instancesById.set(id, this);
    } else if (type === 'delete' && hasInstance) {
      ToastUI.instancesById.delete(id);
    }
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  handleToastCall(event) {
    const toastEvent = /** @type {CustomEvent<ToastDetail>} */ (event);
    const id = toastEvent.detail.id;
    if (id !== this.toastIdentifier) return;

    const currentToast = ToastUI.instancesById.get(id);
    if (currentToast instanceof ToastUI) {
      this.displayToast(currentToast);
    }
  }

  /**
   * @param {ToastUI} element
   * @returns {void}
   */
  displayToast(element) {
    if (!element) return;

    if (element.hideTimeout) clearTimeout(element.hideTimeout);

    element.setAttribute('aria-hidden', 'false');
    element.classList.add('notification-show');

    element.hideTimeout = setTimeout(() => {
      element.classList.remove('notification-show');
      element.setAttribute('aria-hidden', 'true');
    }, ToastUI.DISPLAY_DURATION);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */

  hasInstance(id) {
    return !!ToastUI.instancesById.get(id);
  }
}

if (!customElements.get('toast-ui')) {
  customElements.define('toast-ui', ToastUI);
}
