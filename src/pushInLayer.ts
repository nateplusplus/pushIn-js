import {
  DEFAULT_SPEED,
  PUSH_IN_TO_DATA_ATTRIBUTE,
  PUSH_IN_FROM_DATA_ATTRIBUTE,
  PUSH_IN_SPEED_DATA_ATTRIBUTE,
  PUSH_IN_DEFAULT_TRANSITION_LENGTH,
} from './constants';
import { PushInScene } from './pushInScene';

import { LayerOptions, LayerRef, LayerParams } from './types';

export class PushInLayer {
  public params!: LayerParams;
  private originalScale: number;
  private ref: LayerRef;

  constructor(
    private element: HTMLElement,
    private index: number,
    public scene: PushInScene,
    private options: LayerOptions | null
  ) {
    const inpoints = this.getInpoints(this.element, this.index);
    const outpoints = this.getOutpoints(this.element, inpoints[0]);
    const speed = this.getSpeed(this.element);

    this.originalScale = this.getElementScaleX(element);
    this.ref = { inpoints, outpoints, speed };

    this.element.setAttribute('data-pushin-layer-index', this.index.toString());

    // Set tabindex so we can sync scrolling with screenreaders
    this.element.setAttribute('tabindex', '0');

    this.setLayerParams();
  }

  /**
   * Get the transitions setting, either from the API or HTML attributes.
   *
   * @returns boolean
   */
  private getTransitions(): boolean {
    let transitions = this.options?.transitions ?? true;
    if (this.element.hasAttribute('data-pushin-transitions')) {
      const attr = this.element!.dataset!.pushinTransitions;
      if (attr) {
        transitions = attr !== 'false' && attr !== '0';
      }
    }
    return transitions;
  }

  private getOverlap() {
    const overlap = 0;
    if (this.index > 0) {
      // TODO: get half of the average of each layer’s transitionLength values
    }
  }

  /**
   * Get the transitionStart setting, either from the API or HTML attributes.
   *
   * @returns number
   */
  private getTransitionStart(): number {
    let start =
      this.options?.transitionStart ?? PUSH_IN_DEFAULT_TRANSITION_LENGTH;
    if (this.element.hasAttribute('data-pushin-transition-start')) {
      const attr = <string>this.element!.dataset!.pushinTransitionStart;
      start = parseInt(attr, 10);
    }
    return start;
  }

  /**
   * Get the transitionEnd setting, either from the API or HTML attributes.
   *
   * @returns number
   */
  private getTransitionEnd(): number {
    let end = this.options?.transitionEnd ?? PUSH_IN_DEFAULT_TRANSITION_LENGTH;
    if (this.element.hasAttribute('data-pushin-transition-end')) {
      const attr = <string>this.element!.dataset!.pushinTransitionEnd;
      end = parseInt(attr, 10);
    }
    return end;
  }

  /**
   * Get all inpoints for the layer.
   */
  private getInpoints(element: HTMLElement, index: number): number[] {
    let inpoints = [this.scene.getTop()];
    if (element.dataset[PUSH_IN_FROM_DATA_ATTRIBUTE]) {
      inpoints = element.dataset[PUSH_IN_FROM_DATA_ATTRIBUTE]!.split(',').map(
        inpoint => parseInt(inpoint.trim(), 10)
      );
    } else if (this.options?.inpoints) {
      inpoints = this.options.inpoints;
    } else if (index === 0) {
      inpoints = this.scene.getInpoints();
    } else if (index > 0) {
      // Set default for middle layers if none provided
      const { outpoint } = this.scene.layers[index - 1].params;
      inpoints = [outpoint - this.scene.speedDelta];
    }

    return inpoints;
  }

  /**
   * Get all outpoints for the layer.
   */
  private getOutpoints(element: HTMLElement, inpoint: number): number[] {
    let outpoints = [inpoint + this.scene.layerDepth];

    if (element.dataset[PUSH_IN_TO_DATA_ATTRIBUTE]) {
      const values = element.dataset[PUSH_IN_TO_DATA_ATTRIBUTE]!.split(',');
      outpoints = values.map(value => parseInt(value.trim(), 10));
    } else if (this.options?.outpoints) {
      outpoints = this.options.outpoints;
    }

    return outpoints;
  }

  /**
   * Get the push-in speed for the layer.
   */
  private getSpeed(element: HTMLElement): number {
    let speed: number | null = null;

    if (element.dataset[PUSH_IN_SPEED_DATA_ATTRIBUTE]) {
      speed = parseInt(element.dataset[PUSH_IN_SPEED_DATA_ATTRIBUTE]!, 10);
      if (Number.isNaN(speed)) {
        speed = DEFAULT_SPEED;
      }
    } else if (this.options?.speed) {
      speed = this.options.speed;
    }

    return speed || DEFAULT_SPEED;
  }

  /**
   * Set the z-index of each layer so they overlap correctly.
   */
  setZIndex(total: number): void {
    this.element.style.zIndex = (total - this.index).toString();
  }

  /**
   * Set all the layer parameters.
   *
   * This is used during initalization and
   * if the window is resized.
   */
  setLayerParams(): void {
    this.params = {
      depth: this.getDepth(),
      inpoint: this.getInpoint(this.ref.inpoints),
      outpoint: this.getOutpoint(this.ref.outpoints),
      speed: this.ref.speed,
      transitions: this.getTransitions(),
      transitionStart: this.getTransitionStart(),
      transitionEnd: this.getTransitionEnd(),
    };
  }

  private getDepth(): number {
    return (
      this.getOutpoint(this.ref.outpoints) - this.getInpoint(this.ref.inpoints)
    );
  }

  /**
   * Get the initial scale of the element at time of DOM load.
   */
  private getElementScaleX(element: HTMLElement): number {
    const transform = window
      .getComputedStyle(element)
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
   * Whether or not a layer should currently be zooming.
   */
  private isActive(): boolean {
    const { inpoint } = this.params;
    const { outpoint } = this.params;

    let active = true;

    if (this.params.transitions) {
      const min = this.scene.pushin.scrollY >= inpoint;
      const max = this.scene.pushin.scrollY <= outpoint;
      active = min && max;
    }

    return active;
  }

  /**
   * Get the current inpoint for a layer,
   * depending on window breakpoint.
   */
  private getInpoint(inpoints: number[]): number {
    const { breakpoints } = this.scene.options;
    return inpoints[this.scene.getBreakpointIndex(breakpoints)] || inpoints[0];
  }

  /**
   * Get the current outpoint for a layer,
   * depending on window breakpoint.
   */
  private getOutpoint(outpoints: number[]): number {
    const { breakpoints } = this.scene.options;
    return (
      outpoints[this.scene.getBreakpointIndex(breakpoints)] || outpoints[0]
    );
  }

  /**
   * Get the scaleX value for the layer.
   */
  private getScaleValue(layer: PushInLayer): number {
    const distance = this.scene.pushin.scrollY - layer.params.inpoint;
    const speed = Math.min(layer.params.speed, 100) / 100;
    const delta = (distance * speed) / 100;

    return Math.max(layer.originalScale + delta, 0);
  }

  /**
   * Set element scale.
   */
  private setScale({ style }: HTMLElement, value: number): void {
    const scaleString = `scale(${value})`;
    style.webkitTransform = scaleString;
    (style as unknown as { mozTransform: string }).mozTransform = scaleString;
    (style as unknown as { msTransform: string }).msTransform = scaleString;
    (style as unknown as { oTransform: string }).oTransform = scaleString;
    style.transform = scaleString;
  }

  /**
   * Set CSS styles to control the effect on each layer.
   *
   * This will control the scale and opacity of the layer
   * as the user scrolls.
   */
  setLayerStyle(): void {
    let opacity = 0;
    const isFirst = this.index === 0;
    const isLast = this.index + 1 === this.scene.layers.length;
    const { inpoint } = this.params;
    const { outpoint } = this.params;

    if (isFirst && this.scene.pushin.scrollY < inpoint) {
      opacity = 1;
    } else if (isLast && this.scene.pushin.scrollY > outpoint) {
      opacity = 1;

      if (!this.params.transitions) {
        this.setScale(this.element, this.getScaleValue(this));
      }
    } else if (this.isActive()) {
      this.setScale(this.element, this.getScaleValue(this));

      let inpointDistance =
        Math.max(
          Math.min(
            this.scene.pushin.scrollY - inpoint,
            this.params.transitionStart
          ),
          0
        ) / this.params.transitionStart;

      // Set opacity to 1 if its the first layer and it is active (no fading in here)
      if (isFirst) {
        inpointDistance = 1;
      }

      let outpointDistance =
        Math.max(
          Math.min(
            outpoint - this.scene.pushin.scrollY,
            this.params.transitionEnd
          ),
          0
        ) / this.params.transitionEnd;

      // Set opacity to 1 if its the last layer and it is active (no fading out)
      if (isLast) {
        outpointDistance = 1;
      }

      opacity = this.params.transitions
        ? Math.min(inpointDistance, outpointDistance)
        : 1;
    }

    this.element.style.opacity = opacity.toString();
  }

  /**
   * Set a css class depending on current opacity.
   */
  setLayerVisibility() {
    if (parseFloat(this.element.style.opacity) > 0.1) {
      this.element.classList.add('pushin-layer--visible');
    } else {
      this.element.classList.remove('pushin-layer--visible');
    }
  }
}
