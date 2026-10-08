(function () {
  class ModalTrigger extends HTMLElement {
    constructor() {
      super();

      /** @type {string | null} */
      this.targetModalId = null;

      /** @type {(event:Event) => void} */
      this.handleOpen = this.openTargetModal.bind(this);
    }

    connectedCallback() {
      this.targetModalId = this.dataset.modalId;
      this.addEventListener('click', this.handleOpen);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.handleOpen);
    }

    /**
     * @param {Event} event
     * @returns {void}
     */
    openTargetModal(event) {
      const targetModal = this.getTargetModal();
      if (targetModal) targetModal.toggleModal(event);
    }

    /**
     * @returns {ModalDialog | null}
     */
    getTargetModal() {
      return document.querySelector(`modal-content[data-modal-id="${this.targetModalId || ''}"]`);
    }
  }

  class ModalDialog extends HTMLElement {
    /**
     * @typedef {Object} ManualEvent
     * @property {string} type
     * @property {null} target
     */

    /**
     * @typedef {Object} ModalDetail
     * @property {boolean} isOpen
     * @property {string} type
     * @property {HTMLElement | MediaQueryList | null } target
     */

    /** @typedef {CustomEvent<ModalDetail>} CustomeModalEvent */

    static observedAttributes = ['open'];

    constructor() {
      super();

      /** @type {NodeListOf<HTMLElement>} */
      this.closeTriggers = [];
      /** @type {HTMLElement | null} */
      this.sheetContent = null;
      /** @type {HTMLElement | null} */
      this.dragIcon = null;

      /** @type {boolean} */
      this.isPortaled = false;

      /** @type {boolean} */
      this.useDragClose = false;
      /** @type {boolean} */
      this.isDragging = false;
      /** @type {number} */
      this.startY = 0;

      /** @type {number} */
      this.breakpoint = 768;
      /** @type {MediaQueryList} */
      this.mediaQuery = window.matchMedia(`(max-width: 768px)`);

      /** @type {(event:Event) => void} */
      this.handleClose = this.toggleModal.bind(this);
      /** @type {(event: KeyboardEvent) => void} */
      this.handleKeydown = this.handleEscapeKey.bind(this);
      /** @type {(event: MediaQueryListEvent) => void} */
      this.handleResizeWindow = this.handleResize.bind(this);
      /** @type {(event: MouseEvent | TouchEvent) => void} */
      this.handleDragStart = this.dragStart.bind(this);
      /** @type {(event: MouseEvent | TouchEvent) => void} */
      this.handleDragging = this.dragging.bind(this);
      /** @type {() => void} */
      this.handleDragStop = this.dragStop.bind(this);
    }

    connectedCallback() {
      if (!this.moveToBody()) return;

      this.closeTriggers = this.querySelectorAll('[data-close-modal]');

      this.useDragClose = this.dataset.useDragClose === 'true';
      this.sheetContent = this.querySelector('[data-modal-inner]');
      this.dragIcon = this.querySelector('.modal-content__drag-icon');

      this.breakpoint = Number(this.dataset.breakpoint) || 768;
      this.mediaQuery = window.matchMedia(`(max-width: ${this.breakpoint}px)`);
      this.updatePosition();

      this.closeTriggers.forEach((trigger) => trigger.addEventListener('click', this.handleClose));
      this.mediaQuery.addEventListener('change', this.handleResizeWindow);

      if (this.useDragClose === true && this.dragIcon) this.attachDragEvent();
    }

    disconnectedCallback() {
      this.closeTriggers.forEach((trigger) => trigger.removeEventListener('click', this.handleClose));
      document.removeEventListener('keydown', this.handleKeydown);
      this.mediaQuery.removeEventListener('change', this.handleResizeWindow);

      if (this.useDragClose === true && this.dragIcon) this.detachDragEvent();
    }

    attributeChangedCallback(attributeName, _previousValue, currentValue) {
      if (attributeName === 'open') {
        const isOpen = currentValue !== null;

        this.updateModalState(isOpen);
        document[isOpen ? 'addEventListener' : 'removeEventListener']('keydown', this.handleKeydown);
      }
    }

    /**
     * @param {Event | KeyboardEvent | MediaQueryListEvent | ManualEvent } event
     * @returns {void}
     */
    toggleModal(event) {
      const type = event?.type || 'manual';
      const target = event?.target || null;
      const isOpen = this.hasAttribute('open');

      this.toggleAttribute('open', !isOpen);
      this.dispatchModalEvent({ isOpen: !isOpen, target, type });
 
      document.body.classList.toggle('modal-overflow-hidden', !isOpen);
    }

    /**
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    handleEscapeKey(event) {
      if (event.code.toUpperCase() === 'ESCAPE' && this.hasAttribute('open')) {
        this.toggleModal(event);
      }
    }

    /**
     * @param {MediaQueryListEvent} event
     * @returns {void}
     */
    handleResize(event) {
      this.updatePosition();
      if (this.hasAttribute('open')) this.toggleModal(event);
    }

    /**
     * @returns {void}
     */
    updatePosition() {
      this.dataset.position = this.mediaQuery.matches ? this.dataset.mobilePosition : this.dataset.desktopPosition;
    }

    /**
     * @param {boolean} isOpen
     * @returns {void}
     */
    updateModalState(isOpen) {
      this.toggleAttribute('inert', !isOpen);

      if (isOpen) {
        this.getOtherModals(this).forEach((modal) => modal.removeAttribute('open'));
      }
    }

    /**
     * @param {ModalDialog} activeModal
     * @returns {ModalDialog[]}
     */
    getOtherModals(activeModal) {
      return [...document.querySelectorAll('modal-content[open]')].filter((modal) => modal !== activeModal);
    }

    /**
     * @returns {boolean}
     */
    moveToBody() {
      if (this.isPortaled) return false;

      this.isPortaled = true;
      document.body.appendChild(this);
      return true;
    }

    /**
     * @param {ModalDetail} payload
     * @returns {void}
     */
    dispatchModalEvent(payload) {
      const toggleEvent = new CustomEvent('modal-window:toggle', { detail: payload });
      this.dispatchEvent(toggleEvent);
    }

    /**
     * @returns {void}
     */
    attachDragEvent() {
      this.dragIcon.addEventListener('mousedown', this.handleDragStart);
      document.addEventListener('mousemove', this.handleDragging);
      document.addEventListener('mouseup', this.handleDragStop);

      this.dragIcon.addEventListener('touchstart', this.handleDragStart);
      document.addEventListener('touchmove', this.handleDragging);
      document.addEventListener('touchend', this.handleDragStop);
    }

    /**
     * @returns {void}
     */
    detachDragEvent() {
      this.dragIcon.removeEventListener('mousedown', this.handleDragStart);
      document.removeEventListener('mousemove', this.handleDragging);
      document.removeEventListener('mouseup', this.handleDragStop);

      this.dragIcon.removeEventListener('touchstart', this.handleDragStart);
      document.removeEventListener('touchmove', this.handleDragging);
      document.removeEventListener('touchend', this.handleDragStop);
    }

    /**
     * @param {MouseEvent | TouchEvent} event
     * @returns {void}
     */
    dragStart(event) {
      this.isDragging = true;
      this.startY = event.pageY || event.touches?.[0].pageY;
      this.classList.add('dragging');
    }

    /**
     * @param {MouseEvent | TouchEvent} event
     * @returns {void}
     */
    dragging(event) {
      if (!this.isDragging) return;

      const currentY = event.pageY ?? event.touches?.[0]?.pageY;
      const delta = this.startY - currentY;

      if (delta < 0 && this.sheetContent instanceof HTMLElement) {
        const convertValue = -delta;
        const halfOfHeight = this.sheetContent.clientHeight / 2;

        this.sheetContent.style.transition = 'none';
        this.sheetContent.style.transform = `translateY(${convertValue}px)`;

        if (convertValue > halfOfHeight) {
          this.isDragging = false;

          requestAnimationFrame(() => {
            this.sheetContent.style.transition =
              'transform var(--modal-transition-duration) var(--modal-transition-timing)';
            this.sheetContent.style.transform = 'translateY(100%)';

            this.sheetContent.addEventListener(
              'transitionend',
              (event) => {
                if (event.propertyName !== 'transform') return;

                this.toggleModal();

                this.sheetContent.style.transition = '';
                this.sheetContent.style.transform = '';
              },
              { once: true },
            );
          });
        }
      }
    }

    /**
     * @returns {void}
     */
    dragStop() {
      this.isDragging = false;
      this.classList.remove('dragging');
      this.sheetContent.style.transform = `translateY(0px)`;
    }
  }

  if (!customElements.get('modal-button')) {
    customElements.define('modal-button', ModalTrigger);
  }

  if (!customElements.get('modal-content')) {
    customElements.define('modal-content', ModalDialog);
  }
})();
