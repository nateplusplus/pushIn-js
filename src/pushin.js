/** This will be provided through `DefinePlugin` by Webpack itself. */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * PushIn object
 *
 * Once new object is created, it will initialize itself and
 * bind events to begin interacting with dom.
 */
class PushIn {
  constructor(container, options) {
    this.layers = [];
    this.container = container;

    if (options && !isProduction) {
      this.debug = options.debug || false;
    }
  }

  /**
   * Initialize the object to start everything up.
   */
  start() {
    if (this.container) {
      this.addScene();

      this.speedDelta = 100;
      this.transitionLength = 200;
      this.layerDepth = 1000;

      this.scrollPos = window.pageYOffset;

      this.setBreakpoints();
      this.getLayers();
      this.setScrollLength();
      this.bindEvents();

      // Set layer initial state
      this.toggleLayers();
    } else if (!isProduction) {
      console.error(
        'No container element provided to pushIn.js. Effect will not be applied.'
      );
    }

    if (this.debug) {
      // eslint-disable-next-line no-use-before-define
      showDebugger();
    }
  }

  /**
   * Get the "scene" element from the DOM.
   * If it doesn't exist, make one.
   */
  addScene() {
    this.scene = this.container.querySelector('.pushin-scene');

    if (!this.scene) {
      this.scene = document.createElement('div');
      this.scene.classList.add('pushin-scene');

      this.scene.innerHTML = this.container.innerHTML;
      this.container.innerHTML = '';
      this.container.appendChild(this.scene);
    }
  }

  /**
   * Set breakpoints for responsive design settings.
   */
  setBreakpoints() {
    this.breakpoints = [768, 1440, 1920];

    if (this.scene.dataset.pushinBreakpoints) {
      this.breakpoints = this.scene.dataset.pushinBreakpoints.split(',');
      this.breakpoints = this.breakpoints.map(bp => parseInt(bp.trim(), 10));
    }

    // Always include break point 0 for anything under first breakpoint
    this.breakpoints.unshift(0);
  }

  /**
   * Find all layers on the page and store them with their parameters
   */
  getLayers() {
    const layers = this.container.getElementsByClassName('pushin-layer');

    if (layers) {
      for (let i = 0; i < layers.length; i++) {
        const elem = layers[i];
        const inpoints = this.getInpoints(elem, i);
        const outpoints = this.getOutpoints(elem, inpoints[0]);

        const layer = {
          elem,
          index: i,
          originalScale: this.getElementScaleX(elem),
          ref: {
            inpoints,
            outpoints,
          },
          params: {
            inpoint: this.getInpoint(inpoints),
            outpoint: this.getOutpoint(outpoints),
            speed: this.getSpeed(elem),
          },
        };

        this.layers.push(layer);
        this.setZIndex(layer, layers.length);
      }
    }
  }

  /**
   * Get all inpoints for the layer.
   *
   * @param {HTMLElement} elem
   * @param {number} i
   * @returns {number[]}
   */
  getInpoints(elem, i) {
    const { top } = this.scene.getBoundingClientRect();

    let inpoints = [top];
    if ('pushinFrom' in elem.dataset) {
      inpoints = elem.dataset.pushinFrom.split(',');
      inpoints = inpoints.map(inpoint => parseInt(inpoint.trim(), 10));
    } else if (i === 0 && 'pushinFrom' in this.scene.dataset) {
      // custom inpoint
      inpoints = this.scene.dataset.pushinFrom.split(',');
      inpoints = inpoints.map(inpoint => parseInt(inpoint.trim(), 10));
    } else if (i > 0) {
      // Set default for middle layers if none provided
      const { outpoint } = this.layers[i - 1].params;
      inpoints = [outpoint - this.speedDelta];
    }

    return inpoints;
  }

  /**
   * Get all outpoints for the layer.
   *
   * @param {HTMLElement} elem
   * @param {number} inpoint
   * @returns {number[]}
   */
  getOutpoints(elem, inpoint) {
    let outpoints = [inpoint + this.layerDepth];

    if (Object.prototype.hasOwnProperty.call(elem.dataset, 'pushinTo')) {
      const values = elem.dataset.pushinTo.split(',');
      outpoints = values.map(val => parseInt(val.trim(), 10));
    }

    return outpoints;
  }

  /**
   * Get the push-in speed for the layer.
   * Default: 8.
   *
   * @param {HTMLElement} elem
   * @returns {number}
   */
  getSpeed(elem) {
    const defaultSpeed = 8;
    const speed = Object.prototype.hasOwnProperty.call(
      elem.dataset,
      'pushinSpeed'
    )
      ? elem.dataset.pushinSpeed
      : defaultSpeed;

    let speedInt = parseInt(speed, 10);

    if (Number.isNaN(speedInt)) {
      speedInt = defaultSpeed;
    }

    return speedInt || 8;
  }

  /**
   * Get the array index of the current window breakpoint.
   *
   * @returns {number}
   */
  getBreakpointIndex() {
    const searchIndex = this.breakpoints
      .reverse()
      .findIndex(bp => bp <= window.innerWidth);
    return searchIndex === -1 ? 0 : this.breakpoints.length - 1 - searchIndex;
  }

  /**
   * Set the z-index of each layer so they overlap correctly.
   *
   * @param {object} layer
   * @param {number} total
   */
  setZIndex(layer, total) {
    layer.elem.style.zIndex = total - layer.index;
  }

  /**
   * Bind event listeners to watch for page load and user interaction.
   */
  bindEvents() {
    window.addEventListener('scroll', () => {
      this.scrollPos = window.pageYOffset;
      this.dolly();
    });

    window.addEventListener('touchstart', event => {
      this.touchStart = event.changedTouches[0].screenY;
    });

    window.addEventListener('touchmove', event => {
      event.preventDefault();

      const touchMove = event.changedTouches[0].screenY;
      this.scrollPos = Math.max(
        this.scrollEnd + this.touchStart - touchMove,
        0
      );
      this.scrollPos = Math.min(
        this.scrollPos,
        this.pageHeight - window.innerHeight
      );

      this.dolly();
    });

    window.addEventListener('touchend', () => {
      this.scrollEnd = this.scrollPos;
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        this.resetLayerParams();
        this.setScrollLength();
        this.toggleLayers();
      }, 300);
    });
  }

  /**
   * Reset all the layer parameters.
   *
   * This is used if the window is resized
   * and things need to be recalculated.
   */
  resetLayerParams() {
    this.layers.forEach(layer => {
      layer.params = {
        inpoint: this.getInpoint(layer.ref.inpoints),
        outpoint: this.getOutpoint(layer.ref.outpoints),
        speed: this.getSpeed(layer.elem),
      };
    });
  }

  /**
   * Get the initial scale of the element at time of DOM load.
   *
   * @param {Element} elem
   * @returns {number}
   */
  getElementScaleX(elem) {
    const transform = window
      .getComputedStyle(elem)
      .getPropertyValue('transform');

    let scaleX = 1;
    if (transform && transform !== 'none') {
      const match = transform.match(/[matrix|scale]\(([\d,.\s]+)/);
      if (match && match[1]) {
        const matrix = match[1].split(', ');
        scaleX = parseFloat(matrix[0]);
      }
    }

    return scaleX;
  }

  /**
   * Animation effect, mimicking a camera dolly on the webpage.
   */
  dolly() {
    requestAnimationFrame(() => {
      this.toggleLayers();
    });
  }

  /**
   * Show or hide layers and set their scale, depending on if active.
   */
  toggleLayers() {
    this.layers.forEach(layer => this.setLayerStyle(layer));
  }

  /**
   * Whether or not a layer should currently be zooming.
   *
   * @param {Object} layer
   * @returns {boolean}
   */
  isActive(layer) {
    const { inpoint } = layer.params;
    const { outpoint } = layer.params;
    return this.scrollPos >= inpoint && this.scrollPos <= outpoint;
  }

  /**
   * Get the current inpoint for a layer,
   * depending on window breakpoint.
   *
   * @param {number[]} inpoints
   * @returns {number}
   */
  getInpoint(inpoints) {
    return inpoints[this.getBreakpointIndex()] || inpoints[0];
  }

  /**
   * Get the current outpoint for a layer,
   * depending on window breakpoint.
   *
   * @param {number[]} outpoints
   * @returns {number}
   */
  getOutpoint(outpoints) {
    return outpoints[this.getBreakpointIndex()] || outpoints[0];
  }

  /**
   * Get the scaleX value for the layer.
   *
   * @param {Object} layer
   * @returns {number}
   */
  getScaleValue(layer) {
    const distance = this.scrollPos - layer.params.inpoint;
    const speed = Math.min(layer.params.speed, 100) / 100;
    const delta = (distance * speed) / 100;

    return Math.max(layer.originalScale + delta, 0);
  }

  /**
   * Set element scale.
   *
   * @param {HtmlElement} elem
   * @param {Number} value
   */
  setScale({ style }, value) {
    const scaleString = `scale(${value})`;
    style.webkitTransform = scaleString;
    style.mozTransform = scaleString;
    style.msTransform = scaleString;
    style.oTransform = scaleString;
    style.transform = scaleString;
  }

  /**
   * Set CSS styles to control the effect on each layer.
   *
   * This will control the scale and opacity of the layer
   * as the user scrolls.
   *
   * @param Element layer    Layer element
   */
  setLayerStyle(layer) {
    let opacity = 0;
    const isFirst = layer.index === 0;
    const isLast = layer.index + 1 === this.layers.length;
    const { inpoint } = layer.params;
    const { outpoint } = layer.params;

    if (isFirst && this.scrollPos < inpoint) {
      opacity = 1;
    } else if (isLast && this.scrollPos > outpoint) {
      opacity = 1;
    } else if (this.isActive(layer)) {
      this.setScale(layer.elem, this.getScaleValue(layer));

      let inpointDistance =
        Math.max(Math.min(this.scrollPos - inpoint, this.transitionLength), 0) /
        this.transitionLength;

      // Set opacity to 1 if its the first layer and it is active (no fading in here)
      if (isFirst) {
        inpointDistance = 1;
      }

      let outpointDistance =
        Math.max(
          Math.min(outpoint - this.scrollPos, this.transitionLength),
          0
        ) / this.transitionLength;

      // Set opacity to 1 if its the last layer and it is active (no fading out)
      if (isLast) {
        outpointDistance = 1;
      }

      opacity = Math.min(inpointDistance, outpointDistance);
    }

    layer.elem.style.opacity = opacity;
  }

  /**
   * Set the default container height based on a few factors:
   * 1. Number of layers present
   * 2. The transition length between layers
   * 3. The length of scrolling time during each layer
   *
   * If this calculation is smaller than the container's current height,
   * the current height will be used instead.
   */
  setScrollLength() {
    const containerHeight = getComputedStyle(this.container).height.replace(
      'px',
      ''
    );

    const transitions = (this.layers.length - 1) * this.speedDelta;
    const scrollLength =
      this.layers.length * (this.layerDepth + this.transitionLength);

    this.container.style.height = `${Math.max(
      containerHeight,
      scrollLength - transitions
    )}px`;
  }
}

/**
 * Show a debugging tool appended to the frontend of the page.
 * Can be used to determine best "pushin-from" and "pushin-to" values.
 * This should exist as a separate function so it's tree-shakable when the code
 * is built in production mode.
 */
function showDebugger() {
  const scrollCounter = document.createElement('div');
  scrollCounter.classList.add('pushin-debug');

  const scrollTitle = document.createElement('p');
  scrollTitle.innerText = 'Pushin.js Debugger';
  scrollTitle.classList.add('pushin-debug__title');

  const debuggerContent = document.createElement('div');
  debuggerContent.classList.add('pushin-debug__content');
  debuggerContent.innerText = `Scroll position: ${window.pageYOffset}px`;

  scrollCounter.appendChild(scrollTitle);
  scrollCounter.appendChild(debuggerContent);

  document.body.appendChild(scrollCounter);

  window.addEventListener('scroll', () => {
    debuggerContent.innerText = `Scroll position: ${Math.round(
      window.pageYOffset
    )}px`;
  });
}

exports.PushIn = PushIn;
