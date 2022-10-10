import {ComponentHarness, ComponentHarnessConstructor, handleAutoChangeDetectionStatus, HarnessEnvironment, HarnessLoader, HarnessQuery, TestElement} from '@angular/cdk/testing';
import {UnitTestElement} from '@angular/cdk/testing/testbed';
import {flush, getEl} from './helpers';

/** Type for the query function used to find DOM elements. */
export type QueryFunction = (selector: string, root: Element) =>
    Iterable<Element>|ArrayLike<Element>;

/** Options to configure the environment. */
export interface CatalystHarnessEnvironmentOptions {
  /** The query function used to find DOM elements. */
  queryFn: QueryFunction;
}

/** The default environment options. */
const defaultEnvironmentOptions: CatalystHarnessEnvironmentOptions = {
  queryFn: (selector: string, root: Element) => root.querySelectorAll(selector)
};

/** Whether auto change detection is currently disabled. */
let disableAutoChangeDetection = false;

/** Whether a handler for the auto change detection status is installed. */
let autoChangeDetectionHandlerInstalled = false;

function installAutoChangeDetectionStatusHandler() {
  if (!autoChangeDetectionHandlerInstalled) {
    autoChangeDetectionHandlerInstalled = true;
    handleAutoChangeDetectionStatus(({isDisabled, onDetectChangesNow}) => {
      disableAutoChangeDetection = isDisabled;
      if (onDetectChangesNow) {
        detectChanges();
        onDetectChangesNow();
      }
    });
  }
}

function detectChanges() {
  flush();
}

/** A `HarnessEnvironment` implementation for Catalyst. */
export class CatalystHarnessEnvironment extends HarnessEnvironment<Element> {
  /** The options for this environment. */
  private options: CatalystHarnessEnvironmentOptions;

  protected constructor(
      rawRootElement: Element, options?: CatalystHarnessEnvironmentOptions) {
    super(rawRootElement);
    this.options = {...defaultEnvironmentOptions, ...options};
    installAutoChangeDetectionStatusHandler();
  }

  /** Creates a `HarnessLoader` rooted at the given fixture's root element. */
  static loader(options?: CatalystHarnessEnvironmentOptions): HarnessLoader {
    return new CatalystHarnessEnvironment(getEl(), options);
  }

  /** Gets the native DOM element corresponding to the given TestElement. */
  static getNativeElement(el: TestElement): Element {
    if (el instanceof UnitTestElement) {
      return el.element;
    }
    throw new Error(
        'This TestElement was not created by the CatalystHarnessEnvironment');
  }

  /**
   * Creates a `HarnessLoader` at the document root. This can be used if
   * harnesses are located outside of a fixture (e.g. overlays appended to the
   * document body).
   */
  static documentRootLoader(options?: CatalystHarnessEnvironmentOptions):
      HarnessLoader {
    return new CatalystHarnessEnvironment(document.body, options);
  }

  /**
   * Creates a harness for the component that was bootstrapped in Catalyst. This
   * method ignores the selector of the boostrapped component when loading the
   * harness, as components do not have the correct selector when they are
   * created via the Catalyst `bootstrap` method.
   */
  static async harnessForBootstrappedComponent<T extends ComponentHarness>(
      harnessType: ComponentHarnessConstructor<T>,
      options?: CatalystHarnessEnvironmentOptions): Promise<T> {
    const environment = new CatalystHarnessEnvironment(getEl(), options);
    await environment.forceStabilize();
    return environment.createComponentHarness(harnessType, getEl());
  }

  async forceStabilize(): Promise<void> {
    if (!disableAutoChangeDetection) {
      detectChanges();
    }
  }

  async waitForTasksOutsideAngular(): Promise<void> {
    flush();
  }

  protected getDocumentRoot(): Element {
    return document.body;
  }

  protected createTestElement(element: Element): TestElement {
    return new UnitTestElement(element, () => this.forceStabilize());
  }

  protected createEnvironment(element: Element): HarnessEnvironment<Element> {
    return new CatalystHarnessEnvironment(element, this.options);
  }

  protected async getAllRawElements(selector: string): Promise<Element[]> {
    await this.forceStabilize();
    return Array.from(this.options.queryFn(selector, this.rawRootElement));
  }
}

/**
 * Gets the harness that matches the query.
 * @param query A HarnessQuery for the harness to find. This may be either:
 *   - The constructor for a ComponentHarness, e.g. `MatButton`
 *   - A HarnessPredicate such as one returned by a `.with()` method,
 *     e.g. `MatButton.with({text: 'Ok'})`
 * @param options Options for the harness loader
 *   - useDocumentRoot: whether to search for harnesses under `document.body`
 *     rather than the test's fixture element. Specify `useDocumentRoot: true`
 *     when looking for an element in a `CdkOverlay`, or other elements
 *     programmatically appended to the body
 *   - queryFn: specifies a custom function to use for locating elements,
 *     by default uses `(s, r) => r.querySelectorAll(s)`
 * @return The first instance found of a harness matching the query
 * @throws If no instance of a harness matching the query is found
 */
export function getHarness<T extends ComponentHarness>(
    query: HarnessQuery<T>,
    options?: {useDocumentRoot?: boolean, queryFn?: QueryFunction}):
    Promise<T> {
  const defaultLoader = getDefaultLoader(options);
  return defaultLoader.getHarness(query);
}

/**
 * Gets the harness that matches the query, or null if no match exists.
 * @param query A HarnessQuery for the harness to find. This may be either:
 *   - The constructor for a ComponentHarness, e.g. `MatButton`
 *   - A HarnessPredicate such as one returned by a `.with()` method,
 *     e.g. `MatButton.with({text: 'Ok'})`
 * @param options Options for the harness loader
 *   - useDocumentRoot: whether to search for harnesses under `document.body`
 *     rather than the test's fixture element. Specify `useDocumentRoot: true`
 *     when looking for an element in a `CdkOverlay`, or other elements
 *     programmatically appended to the body
 *   - queryFn: specifies a custom function to use for locating elements,
 *     by default uses `(s, r) => r.querySelectorAll(s)`
 * @return The first instance found of a harness matching the query,
 *         or null if none match
 */
export function getHarnessOrNull<T extends ComponentHarness>(
    query: HarnessQuery<T>,
    options?: {useDocumentRoot?: boolean, queryFn?: QueryFunction}):
    Promise<T|null> {
  const defaultLoader = getDefaultLoader(options);
  return defaultLoader.getHarnessOrNull(query);
}

/**
 * Checks whether a harness matching the query exists.
 * @param query A HarnessQuery for the harness to find. This may be either:
 *   - The constructor for a ComponentHarness, e.g. `MatButton`
 *   - A HarnessPredicate such as one returned by a `.with()` method,
 *     e.g. `MatButton.with({text: 'Ok'})`
 * @param options Options for the harness loader
 *   - useDocumentRoot: whether to search for harnesses under `document.body`
 *     rather than the test's fixture element. Specify `useDocumentRoot: true`
 *     when looking for an element in a `CdkOverlay`, or other elements
 *     programmatically appended to the body
 *   - queryFn: specifies a custom function to use for locating elements,
 *     by default uses `(s, r) => r.querySelectorAll(s)`
 * @return true iff a matching harness is found
 */
export function hasHarness<T extends ComponentHarness>(
    query: HarnessQuery<T>,
    options?: {useDocumentRoot?: boolean, queryFn?: QueryFunction}):
    Promise<boolean> {
  const defaultLoader = getDefaultLoader(options);
  return defaultLoader.hasHarness(query);
}

/**
 * Gets a list of all harnesses that match the query.
 * @param query A HarnessQuery for the harness to find. This may be either:
 *   - The constructor for a ComponentHarness, e.g. `MatButton`
 *   - A HarnessPredicate such as one returned by a `.with()` method,
 *     e.g. `MatButton.with({text: 'Ok'})`
 * @param options Options for the harness loader
 *   - useDocumentRoot: whether to search for harnesses under `document.body`
 *     rather than the test's fixture element. Specify `useDocumentRoot: true`
 *     when looking for an element in a `CdkOverlay`, or other elements
 *     programmatically appended to the body
 *   - queryFn: specifies a custom function to use for locating elements,
 *     by default uses `(s, r) => r.querySelectorAll(s)`
 * @return The list of harness instances matching the query
 */
export function getAllHarnesses<T extends ComponentHarness>(
    query: HarnessQuery<T>,
    options?: {useDocumentRoot?: boolean, queryFn?: QueryFunction}):
    Promise<T[]> {
  const defaultLoader = getDefaultLoader(options);
  return defaultLoader.getAllHarnesses(query);
}

/** Gets the default loader for top-level harness getter functions. */
function getDefaultLoader(
    options?: {useDocumentRoot?: boolean, queryFn?: QueryFunction}) {
  const catalystEnvOptions =
      options?.queryFn ? {queryFn: options.queryFn} : undefined;
  return options?.useDocumentRoot ?
      CatalystHarnessEnvironment.documentRootLoader(catalystEnvOptions) :
      CatalystHarnessEnvironment.loader(catalystEnvOptions);
}

/** Gets the native DOM element corresponding to the given TestElement. */
export const getNativeElement = CatalystHarnessEnvironment.getNativeElement;
