import 'jasmine';
import 'zone.js';

import {AbstractType, ChangeDetectorRef, Component, DebugElement, destroyPlatform, FactoryProvider, InjectionToken, ModuleWithProviders, NgZone, Provider, RendererFactory2, SchemaMetadata, Type, ValueProvider} from '@angular/core';
import {ComponentFixture, ModuleTeardownOptions, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {BrowserDynamicTestingModule, platformBrowserDynamicTesting} from '@angular/platform-browser-dynamic/testing';
import {ANIMATION_MODULE_TYPE} from '@angular/platform-browser/animations';
import {downgradeModule} from '@angular/upgrade/static';
import * as angular from 'angular';
import {asyncScheduler} from 'rxjs';

// tslint:disable-next-line:no-any Zone shenanigans.
const syncTestZoneSpecCtor = (Zone as any)['SyncTestZoneSpec'];

// tslint:disable-next-line:no-any Zone shenanigans.
const fakeAsyncTestZoneSpecCtor = (Zone as any)['FakeAsyncTestZoneSpec'];

// TODO(b/139018875): Export this, once re-exporting semantics are fixed.
let inCatalyst = false;

/** Whether execution is currently being managed by catalyst. */
export function isInCatalyst(): boolean {
  return inCatalyst;
}

let changeDetectionDepth = 0;

// Mock Date setup for the test.
let mockDate: {
  install: (mockedDate?: Date) => void,
  uninstall: () => void,
  tick: (elapsed: number) => void
};
let oldNow: (() => number)|undefined;

// Animation Module Types that should not be allowed in catalyst tests.
const BAD_ANIMATION_MODULES = ['BrowserAnimations'];

// Message to place in the console as an error when BrowserAnimationsModule is
// used in a test environment.
const BAD_ANIMATION_MODULE_MSG = `The NoopAnimationsModule should be used in
  your angular tests to allow the testing framework to ensure the synchronicity
  of the test environment. Continuing to use BrowserAnimationsModule can cause
  unexpected issues in your tests because web animations syncronicity cannot be
  guaranteed.`;

// Additional macro task types from libraries, to be passed to the
// FakeAsyncTestZoneSpec constructor.
const MACRO_TASK_OPTIONS = [
  {source: 'LoadModuleFactory', isPeriodic: false}
];

// Wrap all Jasmine specs, beforeEach and afterEach inside a FakeAsyncTestZone
// to capture all async tasks scheduled.

// Re-export under a different name so that it's clear which version is being
// used.

declare const global: {};
interface GlobalWithJasmine {
  // tslint:disable-next-line:no-any the original already uses any
  expect: (actual?: any) => jasmine.Matchers<any>& jasmine.NothingMatcher;
  afterEach: Function;
  afterAll: Function;
  beforeEach: Function;
  beforeAll: Function;
  describe: Function;
  fdescribe: Function;
  xdescribe: Function;
  it: Function;
  fit: Function;
  xit: Function;
  __zone_symbol__disableDatePatching: boolean;
}
const globalInternal: GlobalWithJasmine =
    (typeof window === 'undefined' ? global : window) as GlobalWithJasmine;

// Disable Date patching from the Zone.js side since we handle it ourselves.
globalInternal['__zone_symbol__disableDatePatching'] = true;

// Export `expect` so that it is not needed from the ambient Jasmine typings.
/** @checkReturnValue */
export const expect = globalInternal.expect;

/** Catalyst wrapper to done. */
export interface DoneFn {
  (): void;
  fail: (message?: Error|string) => void;
}

type SpecFn = (done: DoneFn) => void;
type SpecFnStrict = () => void;

function initTestEnvironment(config: ModuleConfig) {
  try {
    TestBed.initTestEnvironment(
        BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
          teardown: {
            destroyAfterEach: !!config.teardown?.destroyAfterEach,
            // `rethrowErrors` should default to true, per interface
            // specification.
            rethrowErrors: config.teardown?.rethrowErrors ?? true,
          }
        });
  } catch (e: unknown) {
    // Ignore exceptions when calling it multiple times.
  }
}

function patchClock(mockedDate?: Date) {
  // tslint:disable-next-line:no-any Access internal jasmine MockDate
  mockDate = new (jasmine as any).MockDate(globalInternal);
  mockDate.install(mockedDate);

  // Monkey patch the now() method in RxJS async scheduler.
  oldNow = asyncScheduler.now;
  asyncScheduler.now = Date.now;
}

function unpatchClock() {
  if (mockDate) {
    mockDate.uninstall();
  }
  if (oldNow) {
    asyncScheduler.now = oldNow;
    oldNow = undefined;
  }
}

function reset() {
  inCatalyst = false;
  if (fixture) {
    fixture.destroy();
  }
  resetFakeAsyncZone();
  fixture = null;
  isTestModuleSetup = false;
  isCompilationDone = false;

  // Unilaterally destroy the platform while resetting to
  // transparently allow Ng1/Ng2 tests to be handled in the same runner.
  // Failing to do this causes Ng2's assertPlatform to throw when Ng2
  // follows Ng1 which is ignored by the initTestEnvironment wrapper.
  // setupNg1Module would handle this implicitly if it happened to come second,
  // but does not handle the case where Ng1 precedes Ng2.
  destroyPlatform();

  unpatchClock();
}

function wrapDescribe(
    describeFunc: Function, description: string, specDefinitions: () => void,
    mockedDate?: Date) {
  return describeFunc(description, function(this: jasmine.Suite) {
    const topLevel =
        this.parentSuite != null && this.parentSuite.parentSuite == null;

    // Register Catalyst specific beforeEach/afterEach on the top-level
    // describe. Done here so that this is not setup for non-Catalyst test
    // suites in the same test suite.
    if (topLevel) {
      getOriginalFunction('beforeEach')(() => {
        reset();

        changeDetectionDepth = 0;

        // Patch all known clocks to track the fakeAsync tick and flush.
        patchClock(mockedDate);
      });

      getOriginalFunction('afterEach')((done: Function) => {
        reset();
        // Need to do a done() so that Jasmine logger has an oppotunity
        // to update the Karma server or the server will think the test suite
        // has timed out when it runs a bunch of synchronous tests together.
        done();
      });
    }

    // Make sure there are no async tasks outside of the before*, it, after*.
    Zone.current.fork(new syncTestZoneSpecCtor('catalyst')).run(() => {
      specDefinitions();
    });
  });
}

/** Catalyst wrapper to describe. */
export interface Describe {
  (description: string, specDefinitions: () => void): {};
  only: (description: string, specDefinitions: () => void) => {};
  skip: (description: string, specDefinitions: () => void) => {};
}

/**
 * Catalyst wrapper to describe.
 */
function describeInternal(
    description: string, specDefinitions: () => void, mockedDate?: Date) {
  return wrapDescribe(
      globalInternal.describe, description, specDefinitions, mockedDate);
}

/**
 * Wrapper that allows you to configure the mocked current date that catalyst
 * sets.
 */
export interface DescribeWithDate {
  (description: string, mockedDate: Date, specDefinitions: () => void): {};
  only:
      (description: string, mockedDate: Date,
       specDefinitions: () => void) => {};
  skip:
      (description: string, mockedDate: Date,
       specDefinitions: () => void) => {};
}

/**
 * Wrapper that allows you to configure the mocked current date that catalyst
 * sets.
 */
function describeWithDateInternal(
    description: string, mockedDate: Date, specDefinitions: () => void) {
  return describeInternal(description, specDefinitions, mockedDate);
}
function xdescribeWithDateInternal(
    description: string, mockedDate: Date, specDefinitions: () => void) {
  return xdescribeInternal(description, specDefinitions, mockedDate);
}
function fdescribeWithDateInternal(
    description: string, mockedDate: Date, specDefinitions: () => void) {
  return fdescribeInternal(description, specDefinitions, mockedDate);
}

/**
 * Catalyst wrapper to xdescribe.
 */
export function xdescribe(description: string, specDefinitions: () => void) {
  console.warn(
      `Catalyst: 'xdescribe()' is deprecated. ` +
      `Use 'describe.skip()' instead`);
  return xdescribeInternal(description, specDefinitions);
}

function xdescribeInternal(
    description: string, specDefinitions: () => void, mockedDate?: Date) {
  return wrapDescribe(
      getOriginalFunction('xdescribe'), description, specDefinitions,
      mockedDate);
}
/**
 * Catalyst wrapper to fdescribe.
 */
export function fdescribe(description: string, specDefinitions: () => void) {
  console.warn(
      `Catalyst: 'fdescribe()' is deprecated. ` +
      `Use 'describe.only()' instead`);
  return fdescribeInternal(description, specDefinitions);
}

function fdescribeInternal(
    description: string, specDefinitions: () => void, mockedDate?: Date) {
  return wrapDescribe(
      getOriginalFunction('fdescribe'), description, specDefinitions,
      mockedDate);
}

/** Catalyst wrapper to it. */
export interface It {
  (description: string, specDefinitions: SpecFnStrict, timeout?: number): {};
  only:
      (description: string, specDefinitions: SpecFnStrict,
       timeout?: number) => {};
  skip:
      (description: string, specDefinitions: SpecFnStrict,
       timeout?: number) => {};
  async: {
    (description: string, specDefinitions: SpecFnStrict, timeout?: number): {};
    only:
        (description: string, specDefinitions: SpecFnStrict,
         timeout?: number) => {};
    skip:
        (description: string, specDefinitions: SpecFnStrict,
         timeout?: number) => {};
  };
  /**
   * A version of `it` that preserves the (incorrect) behavior of not checking
   * that a promise returned from the test has finished. It will be removed
   * once go/catalyst-it-async-problem fixes are implemented.
   */
  broken: {
    /**
     * @deprecated `it.broken` with an async spec (or a spec that returns a
     *     promise) is not guaranteed to finish. Use `it` or `it.async` instead.
     *     See also: go/catalyst-it-async-problem
     */
    (description: string, specDefinitions: SpecFn, timeout?: number): {};
    /**
     * @deprecated `it.broken` with an async spec (or a spec that returns a
     *     promise) is not guaranteed to finish. Use `it` or `it.async` instead.
     *     See also: go/catalyst-it-async-problem
     */
    only:
        (description: string, specDefinitions: SpecFn, timeout?: number) => {};
    /**
     * @deprecated `it.broken` with an async spec (or a spec that returns a
     *     promise) is not guaranteed to finish. Use `it` or `it.async` instead.
     *     See also: go/catalyst-it-async-problem
     */
    skip:
        (description: string, specDefinitions: SpecFn, timeout?: number) => {};
  };
}

/** Interface for itLegacy. */
export interface ItLegacy {
  (description: string, specDefinitions: SpecFn, timeout?: number): {};
  only: (description: string, specDefinitions: SpecFn, timeout?: number) => {};
  skip: (description: string, specDefinitions: SpecFn, timeout?: number) => {};
}

function getOriginalFunction(name: string) {
  const env = jasmine.getEnv();
  const symbol = Zone.__symbol__(name);
  // tslint:disable-next-line:no-any
  return (env as any)[symbol] || (globalInternal as any)[name];
}

/**
 * Catalyst wrapper to 'it', broken version (doesn't wait for returned promise
 * to complete). Will be removed as part of go/catalyst-it-async-problem.
 *
 * @param timeout optional timeout in milliseconds
 */
function itInternalBroken(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  const originalIt = getOriginalFunction('it');
  return originalIt(
      description, wrapTestInFakeAsyncZone(specDefinitions), timeout);
}

/**
 * Catalyst wrapper to 'it'.
 * @param timeout optional timeout in milliseconds
 */
function itInternalStrict(
    description: string, specDefinitions: SpecFnStrict, timeout?: number) {
  return strictFromOriginal('it', description, specDefinitions, timeout);
}

function xitInternalStrict(
    description: string, specDefinitions: SpecFnStrict, timeout?: number) {
  return strictFromOriginal('xit', description, specDefinitions, timeout);
}

function fitInternalStrict(
    description: string, specDefinitions: SpecFnStrict, timeout?: number) {
  return strictFromOriginal('fit', description, specDefinitions, timeout);
}

function strictFromOriginal(
    originalFunctionName: string, description: string,
    specDefinitions: SpecFnStrict, timeout?: number) {
  const originalIt = getOriginalFunction(originalFunctionName);
  return originalIt(
      description, wrapTestInFakeAsyncZone(specDefinitions, true, true),
      timeout);
}

/**
 * Legacy wrapper of `it()` which does **not** `flush()` after executing a test
 * that returns a Promise. This exists to support tests which would otherwise be
 * broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link it}.
 */
function itLegacyInternal(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  const originalIt = getOriginalFunction('it');
  return originalIt(
      description,
      wrapTestInFakeAsyncZone(specDefinitions, false /* flush */),
      timeout,
  );
}

/**
 * Expose the original 'it' function for true async tests.
 */
function itAsync(
    description: string, specDefinitions: SpecFnStrict, timeout?: number) {
  const originalIt = getOriginalFunction('it');
  return originalIt(description, async () => {
    inCatalyst = true;
    await specDefinitions();
    inCatalyst = false;
  }, timeout);
}

/**
 * Expose the original 'xit' function for true async tests.
 */
function xitAsync(
    description: string, specDefinitions: SpecFnStrict, timeout?: number) {
  const originalXit = getOriginalFunction('xit');
  return originalXit(description, async () => {
    inCatalyst = true;
    await specDefinitions();
    inCatalyst = false;
  }, timeout);
}

/**
 * Expose the original 'fit' function for true async tests.
 */
function fitAsync(
    description: string, specDefinitions: SpecFnStrict, timeout?: number) {
  const originalFit = getOriginalFunction('fit');
  return originalFit(description, async () => {
    inCatalyst = true;
    await specDefinitions();
    inCatalyst = false;
  }, timeout);
}

/**
 * Catalyst wrapper to 'xit'.
 * @param timeout optional timeout in milliseconds
 */
export function xit(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  console.warn(`Catalyst: 'xit()' is deprecated. Use 'it.skip()' instead`);
  return xitInternal(description, specDefinitions, timeout);
}

function xitInternal(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  const originalXit = getOriginalFunction('xit');
  return originalXit(
      description, wrapTestInFakeAsyncZone(specDefinitions), timeout);
}

/**
 * Catalyst wrapper to 'fit'.
 * @param timeout optional timeout in milliseconds
 */
export function fit(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  console.warn(`Catalyst: 'fit()' is deprecated. Use 'it.only()' instead`);
  return fitInternal(description, specDefinitions, timeout);
}

function fitInternal(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  const originalFit = getOriginalFunction('fit');
  return originalFit(
      description, wrapTestInFakeAsyncZone(specDefinitions), timeout);
}

/**
 * Legacy wrapper of `fit()` which does **not** `flush()` after executing a test
 * that returns a Promise. This exists to support tests which would otherwise be
 * broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link fit}.
 */
export function fitLegacy(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  console.warn(`Catalyst: 'fit()' is deprecated. Use 'it.only()' instead`);
  return fitLegacyInternal(description, specDefinitions, timeout);
}

/**
 * Legacy wrapper of `fit()` which does **not** `flush()` after executing a test
 * that returns a Promise. This exists to support tests which would otherwise be
 * broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link fit}.
 */
function fitLegacyInternal(
    description: string, specDefinitions: SpecFn, timeout?: number) {
  const originalFit = getOriginalFunction('fit');
  return originalFit(
      description,
      wrapTestInFakeAsyncZone(specDefinitions, false /* flush */),
      timeout,
  );
}

/** Catalyst wrapper to 'beforeEach'. */
export interface BeforeEach {
  /**
   * Catalyst wrapper to 'beforeEach'.
   * @param timeout optional timeout in milliseconds
   */
  (specDefinitions: SpecFnStrict, timeout?: number): {};

  /**
   * Catalyst wrapper to 'beforeEach' using the async Zone.
   * @param timeout optional timeout in milliseconds
   */
  async: (specDefinitions: SpecFnStrict, timeout?: number) => {};

  /**
   * A version of `beforeEach` that preserves the (incorrect) behavior of not
   * checking that a promise returned from the test has finished. It will be
   * removed once go/catalyst-it-async-problem fixes are implemented.
   *
   * @deprecated `beforeEach.broken` with an async spec (or a spec that returns
   *     a promise) is not guaranteed to finish. Use `beforeEach` or
   *     `beforeEach.async` instead. See also: go/catalyst-it-async-problem
   */
  broken: (specDefinitions: SpecFn, timeout?: number) => {};
}

// Define shortcuts to xdescribe, fdescribe, xit and fit so that they don't have
// to be imported every time.
// Use describe.only, describe.skip, it.only, it.skip instead.

describeInternal.skip = xdescribeInternal;
describeInternal.only = fdescribeInternal;
/** Catalyst wrapper to describe. */
export const describe: Describe = describeInternal;

describeWithDateInternal.skip = xdescribeWithDateInternal;
describeWithDateInternal.only = fdescribeWithDateInternal;
/** Catalyst wrapper to describeWithDate. */
export const describeWithDate: DescribeWithDate = describeWithDateInternal;

itInternalBroken.skip = xitInternal;
itInternalBroken.only = fitInternal;
itAsync.skip = xitAsync;
itAsync.only = fitAsync;
itInternalStrict.skip = xitInternalStrict;
itInternalStrict.only = fitInternalStrict;

itInternalStrict.async = itAsync;
itInternalStrict.broken = itInternalBroken;

/** Catalyst wrapper to it. */
export const it: It = itInternalStrict;

/**
 * Legacy wrapper of `it.skip()` which does **not** `flush()` after executing a
 * test that returns a Promise. This exists to support tests which would
 * otherwise be broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link it.skip}.
 */
itLegacyInternal.skip = xitInternal;

/**
 * Legacy wrapper of `it.only()` which does **not** `flush()` after executing a
 * test that returns a Promise. This exists to support tests which would
 * otherwise be broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link it.only}.
 */
itLegacyInternal.only = fitLegacyInternal;

/**
 * Legacy wrapper of `it()` which does **not** `flush()` after executing a test
 * that returns a Promise. This exists to support tests which would otherwise be
 * broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link it}.
 */
export const itLegacy: ItLegacy = itLegacyInternal;

beforeEachInternal.async = beforeEachAsync;
beforeEachInternal.broken = beforeEachBroken;
/**
 * Catalyst wrapper to 'beforeEach'.
 */
export const beforeEach: BeforeEach = beforeEachInternal;

function beforeEachInternal(specDefinitions: SpecFnStrict, timeout?: number) {
  const originalBeforeEach = getOriginalFunction('beforeEach');
  return originalBeforeEach(
      wrapTestInFakeAsyncZone(specDefinitions, true, true), timeout);
}

function beforeEachBroken(specDefinitions: SpecFn, timeout?: number) {
  const originalBeforeEach = getOriginalFunction('beforeEach');
  return originalBeforeEach(wrapTestInFakeAsyncZone(specDefinitions), timeout);
}

/**
 * Legacy wrapper of `beforeEach()` which does **not** `flush()` after executing
 * a code block that returns a Promise. This exists to support tests which would
 * otherwise be broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link beforeEach}.
 */
export function beforeEachLegacy(specDefinitions: SpecFn, timeout?: number) {
  const originalBeforeEach = getOriginalFunction('beforeEach');
  return originalBeforeEach(
      wrapTestInFakeAsyncZone(specDefinitions, false /* flush */), timeout);
}

/**
 * Expose the original 'beforeEach' function for true async tests.
 */
function beforeEachAsync(specDefinitions: SpecFnStrict, timeout?: number) {
  const originalBeforeEach = getOriginalFunction('beforeEach');
  return originalBeforeEach(async () => {
    inCatalyst = true;
    await specDefinitions();
    inCatalyst = false;
  }, timeout);
}

/**
 * Catalyst wrapper to 'beforeAll'.
 * @param timeout optional timeout in milliseconds
 */
export function beforeAll(specDefinitions: SpecFn, timeout?: number) {
  return getOriginalFunction('beforeAll')(specDefinitions, timeout);
}

/**
 * Catalyst wrapper to 'afterEach'.
 * @param timeout optional timeout in milliseconds
 */
export function afterEach(specDefinitions: SpecFnStrict, timeout?: number) {
  const originalAfterEach = getOriginalFunction('afterEach');
  return originalAfterEach(
      wrapTestInFakeAsyncZone(specDefinitions, true, true), timeout);
}

/**
 * Legacy wrapper of `afterEach()` which does **not** `flush()` after executing
 * a code block that returns a Promise. This exists to support tests which would
 * otherwise be broken by adding this `flush()` call.
 *
 * @see http://b/144701308#comment16.
 * @deprecated Tests that are using this function should be updated so that they
 *   work with the implicit flush at the end and switched to {@link afterEach}.
 */
export function afterEachLegacy(specDefinitions: SpecFn, timeout?: number) {
  const originalAfterEach = getOriginalFunction('afterEach');
  return originalAfterEach(
      wrapTestInFakeAsyncZone(specDefinitions, false /* flush */), timeout);
}

/**
 * Catalyst wrapper to 'afterAll'.
 * @param timeout optional timeout in milliseconds
 */
export function afterAll(specDefinitions: SpecFn, timeout?: number) {
  return getOriginalFunction('afterAll')(specDefinitions, timeout);
}

// tslint:disable-next-line:no-any
function isPromise(obj: any): obj is PromiseLike<unknown> {
  return obj && typeof obj === 'object' && typeof obj.then === 'function';
}

function wrapTestInFakeAsyncZone(
    specDefinitions: SpecFn, flush = true, strict = false) {
  return function(this: {}, ...args: [DoneFn]) {
    // Don't return the return value from the test method. This makes sure
    // that the test is always treated as a synchronous test even if it is
    // returning a Promise. This is needed to support async/await test methods
    // that are actually run synchronously when the microtask queue is flushed
    // in the afterEach.
    getFakeAsyncZone().run(() => {
      inCatalyst = true;
      let result;
      let unsafeAsync = false;
      try {
        result = specDefinitions.apply(this, args);
      } finally {
        if (isPromise(result)) {
          const resetFlag = () => {
            inCatalyst = false;
          };
          const resetFlagError = (error: Error) => {
            resetFlag();
            throw error;
          };
          result.then(resetFlag, resetFlagError);

          if (flush) {
            // Flush any remaining tasks to ensure the test is executed fully.
            flushInternal();
            if (inCatalyst) {
              unsafeAsync = true;
            }
          } else {
            // Legacy tests only flush microtasks, don't run change detection
            // after completion.
            flushMicroTasks();
          }
        } else {
          inCatalyst = false;
        }
      }
      if (unsafeAsync) {
        if (strict) {
          fail(
              `Test returned a promise that didn't resolve within the fake ` +
              `async zone. It either never completes or waits for real async ` +
              `data (use it.async in this case).`);
        } else {
          console.warn(
              `Test returned a promise that didn't resolve within the fake ` +
              `async zone. It either never completes or waits for real async ` +
              `data (use it.async in this case). This warning will become an ` +
              `error soon. See go/catalyst-it-async-problem for more details.`);
        }
      }
    });
  };
}

let zoneInitialized = false;
let fakeAsyncTestZoneSpec: ZoneSpec&{
  flushMicrotasks: () => void,
  tick: (millis: number, doTick?: (elapsed: number) => void) => void,
  flush:
      (limit?: number, flushPeriodic?: boolean,
       doTick?: (elapsed: number) => void) => number,
};
let fakeAsyncTestZone: Zone;

function getFakeAsyncZone() {
  if (zoneInitialized) {
    return fakeAsyncTestZone;
  }
  // Augment the FakeAsyncZoneSpec to automatically flush the microtask queue
  // after a task has been invoked. This synchronously stabilizes Angular
  // after an event handler has been invoked.
  fakeAsyncTestZoneSpec =
      new fakeAsyncTestZoneSpecCtor('catalyst', false, MACRO_TASK_OPTIONS);
  fakeAsyncTestZoneSpec.properties = {
    'FakeAsyncTestZoneSpec': fakeAsyncTestZoneSpec,
    'Catalyst': true,
  };
  fakeAsyncTestZoneSpec.onInvokeTask =
      (parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone,
       // tslint:disable-next-line:no-any match Zone typings
       task: Task, applyThis: any[], applyArgs?: any[]) => {
        try {
          return parentZoneDelegate.invokeTask(
              targetZone, task, applyThis, applyArgs);
        } finally {
          // Only interested in tasks invoked in the child NgZone and not the
          // ones directly invoked in our zone (Also avoids infinite recursion).
          if (changeDetectionDepth === 0 && task.type === 'eventTask' &&
              currentZone !== targetZone) {
            let ngZone: NgZone|null = null;
            try {
              ngZone = TestBed.inject(NgZone);
            } catch (e) {
              // the Injector has already been destroyed, that's ok, we'll flush
              // the microtask queue in the next `if` to ensure that no
              // microtasks leak in between tests.
            }
            if (!ngZone || !ngZone.isStable) {
              flushMicroTasks();
            }
          }
        }
      };
  fakeAsyncTestZone = Zone.current.fork(fakeAsyncTestZoneSpec);
  zoneInitialized = true;
  return fakeAsyncTestZone;
}

function getFakeAsyncTestZoneSpec() {
  if (!zoneInitialized) {
    throw new Error('Internal error: FakeAsyncZone not created yet.');
  }
  return fakeAsyncTestZoneSpec;
}

function resetFakeAsyncZone() {
  zoneInitialized = false;
}

/** Template override config. */
export interface TemplateOverride {
  component: Type<{}>;
  template: string;
}

/** Extra configuration of AngularJS Scope. */
export interface ScopeConfig {
  // tslint:disable-next-line:no-any arbitrary value type.
  [attrName: string]: any;
}

/**
 * Configuration passed into setupModule to setup the testing NgModule.
 */
export interface ModuleConfig {
  imports?: Array<Type<{}>|ModuleWithProviders<{}>>|null;
  declarations?: Array<Type<{}>>|null;
  providers?: Provider[]|null;
  superProviders?: Provider[]|null;
  /**
   * @deprecated This legacy config option is unused and will be removed.
   */
  useDeprecatedOverrideProvider?: boolean;
  /**
   * @deprecated summary files are unused and passing them has no effect. All
   *     Components and NgModules are still AOT-compiled, but the generated code
   *     is included into a corresponding class (thus no need to pass anything
   *     extra). Please refactor your tests to avoid passing summary files. This
   *     field will be completely removed in the future.
   */
  // tslint:disable-next-line:no-any original Angular type is `any`
  summaries?: any[];
  templateOverrides?: TemplateOverride[];
  ng1Modules?: angular.IModule[]|null;
  ng1Scope?: ScopeConfig|null;
  schemas?: Array<SchemaMetadata|Array<{}>>;
  teardown?: ModuleTeardownOptions;
}

let isTestModuleSetup = false;
let $injector: angular.auto.IInjectorService|null = null;

/**
 * Get extra providers used by downgraded ng2 module
 * The extra providers should be consistent with
 * packages/upgrade/src/static/angular1_providers.ts
 */
function getNg1Providers(ng1Modules: angular.IModule[]) {
  // Reset global $injector when resetting ng1modules
  $injector = null;

  return [
    {
      provide: '$injector',
      useFactory: () => {
        if ($injector) return $injector;
        // tslint:disable-next-line:no-any
        const modules: any[] = [];
        const root = angular.element(document.body);
        for (const ng1module of ng1Modules) {
          modules.unshift(ng1module.name);
        }
        modules.unshift([
          '$provide',
          ($provide: angular.auto.IProvideService) => {
            $provide.value('$rootElement', root);
          }
        ]);
        modules.unshift('ng');
        $injector = angular.injector(modules, false);
        return $injector;
      }
    },
    {
      provide: '$rootScope',
      useFactory: ($injector: angular.auto.IInjectorService) => {
        return $injector.get('$rootScope');
      },
      deps: ['$injector']
    },
    {
      provide: '$compile',
      useFactory: ($injector: angular.auto.IInjectorService) => {
        return $injector.get('$compile');
      },
      deps: ['$injector']
    },
    {
      provide: '$parse',
      useFactory: ($injector: angular.auto.IInjectorService) => {
        return $injector.get('$parse');
      },
      deps: ['$injector']
    }
  ];
}

/**
 * Get scope provider used by downgraded ng2 module based on the extra
 * information provided by ScopeConfig
 */
function getScopeProvider(config: ScopeConfig) {
  return {
    provide: '$scope',
    useFactory: ($rootScope: angular.IRootScopeService) => {
      const childscope = $rootScope.$new();
      Object.assign(childscope, config);
      return childscope;
    },
    deps: ['$rootScope']
  };
}

function setupModuleInternal(config: ModuleConfig) {
  isTestModuleSetup = true;

  // Always add DynamicTemplateComponent to the declarations list.
  const declarations = config.declarations || [];
  declarations.push(DynamicTemplateComponent);

  // Generate ng1 providers if ng1Modules or ng1scope was set
  if (config.ng1Modules || config.ng1Scope) {
    const ng1Modules = config.ng1Modules || [];
    config.superProviders = config.superProviders || [];
    config.superProviders.push(...getNg1Providers(ng1Modules));
    // Generate scope provider if scope config was set
    if (config.ng1Scope) {
      config.superProviders.push(getScopeProvider(config.ng1Scope));
    }
  }

  // Add all superProviders as regular providers as well.
  // This is needed because overrideProviders requires the tokens to be provided
  // as regular providers before overriding.
  const providers: Provider[] = config.providers || [];
  if (config.superProviders) {
    config.superProviders.forEach(provider => {
      providers.push(provider);
    });
  }

  return getFakeAsyncZone().run(() => {
    // Automatically initialize the global test environment if it hasn't been
    // setup already.
    initTestEnvironment(config);

    TestBed.configureTestingModule({
      imports: config.imports || [],
      declarations,
      providers,
      schemas: config.schemas || [],
    });

    if (config.useDeprecatedOverrideProvider == null) {
      config.useDeprecatedOverrideProvider = false;
    }
    // Handle all super overrides.
    // TODO(b/66717781): add special cases to deal with useClass and useExisting
    // appropriately.
    if (config.superProviders) {
      // TODO: Properly handle useClass in superProviders.
      const overrideProvider = (provider: Provider) => {
        if (Array.isArray(provider)) {
          provider.forEach(overrideProvider);
        } else {
          const normalizedProvider =
              provider as ValueProvider & FactoryProvider;
          if (normalizedProvider.provide && normalizedProvider.useValue) {
            const valueProvider = provider as ValueProvider;
            TestBed.overrideProvider(valueProvider.provide, valueProvider);
          } else if (
              normalizedProvider.provide && normalizedProvider.useFactory) {
            const factoryProvider = provider as FactoryProvider;
            TestBed.overrideProvider(factoryProvider.provide, {
              useFactory: factoryProvider.useFactory,
              deps: factoryProvider.deps ? factoryProvider.deps : [],
            });
          }
        }
      };
      overrideProvider(config.superProviders);
    }

    // Override any templates.
    if (config.templateOverrides) {
      for (const override of config.templateOverrides) {
        TestBed.overrideTemplateUsingTestingModule(
            override.component, override.template);
      }
    }
  });
}

let fixture: ComponentFixture<{}>|null = null;
function getFixture() {
  if (fixture == null) {
    throw new Error('Please call bootstrap() first');
  }
  return fixture;
}

let isCompilationDone = false;
function compileComponents() {
  if (!isCompilationDone) {
    TestBed.compileComponents();
    flushMicroTasks();
    isCompilationDone = true;
  }
}

function createComponentInternal<T>(
    component: Type<T>, inputs: Partial<T> = {},
    beforeChangeDetection?: (comp: T) => void, flush = true): T {
  compileComponents();

  const fix = TestBed.createComponent(component);
  const comp = fix.componentInstance;
  for (const key in inputs) {
    if (inputs.hasOwnProperty(key)) {
      const value = inputs[key] as T[Extract<keyof T, string>];
      comp[key] = value;
    }
  }

  fixture = fix;

  // Hook into the RendererFactory2 begin() and end() to be notified when
  // the change detection cycle starts and stops.
  const rf = TestBed.inject(RendererFactory2);
  const origBegin = rf.begin;
  const origEnd = rf.end;
  rf.begin = () => {
    changeDetectionDepth++;
    if (origBegin) {
      origBegin.apply(rf);
    }
  };
  rf.end = () => {
    if (origEnd) {
      origEnd.apply(rf);
    }
    changeDetectionDepth--;
  };

  // Run callback to make changes to the component instance(like setting up
  // spies) before the initial change detection is run.
  if (beforeChangeDetection) {
    beforeChangeDetection(comp);
  }

  fixture.autoDetectChanges();

  if (!mockDate) {
    throw new Error(
        'mockDate is undefined. Is your `describe` imported from catalyst?');
  }
  if (flush) {
    // Flush only the setTimeout-s at bootstrap.
    getFakeAsyncTestZoneSpec().flush(1000, false, mockDate.tick);
  }

  return comp;
}

function bootstrapInternal<T>(
    component: Type<T>, inputs: Partial<T> = {},
    beforeChangeDetection?: (comp: T) => void, flush = true): T {
  if (!isTestModuleSetup) {
    throw new Error('Please call setupModule() before bootstrap()');
  }

  const createdComponent =
      createComponent(component, inputs, beforeChangeDetection, flush);

  if (BAD_ANIMATION_MODULES.includes(
          TestBed.inject<string>(ANIMATION_MODULE_TYPE, ''))) {
    console.error(new Error(BAD_ANIMATION_MODULE_MSG));
  }

  return createdComponent;
}

let componentInstance: {[k: string]: {}};

// A Dynamic test component used by bootstrapTemplate.
@Component({
  preserveWhitespaces: true,
  selector: 'dynamic-template-component',
  template: ''
})
class DynamicTemplateComponent {
  constructor() {
    // Proxy property access to the underlying instance object.
    for (const key in componentInstance) {
      if (componentInstance.hasOwnProperty(key)) {
        Object.defineProperty(this, key, {
          get: () => componentInstance[key],
          set: (value) => {
            componentInstance[key] = value;
          },
          enumerable: true,
        });
      }
    }
  }
}

function bootstrapTemplateInternal<T>(
    templateString: string, instance: Partial<T>,
    beforeChangeDetection?: (comp: T) => void, flush = true): T {
  if (!isTestModuleSetup) {
    throw new Error('Please call setupModule() before bootstrapTemplate()');
  }

  if (isCompilationDone) {
    throw new Error('Cannot call bootstrapTemplate() after get()');
  }
  function getComponent(template: string, instance: Partial<T>): Type<T> {
    componentInstance = instance as {};
    TestBed.overrideTemplate(DynamicTemplateComponent, template);
    return DynamicTemplateComponent as Type<T>;
  }

  const createdComponent = createComponent(
      getComponent(templateString, instance), {}, beforeChangeDetection, flush);

  if (BAD_ANIMATION_MODULES.includes(
          TestBed.inject<string>(ANIMATION_MODULE_TYPE, ''))) {
    console.error(new Error(BAD_ANIMATION_MODULE_MSG));
  }

  return createdComponent;
}

function tickInternal(millis: number) {
  getFakeAsyncTestZoneSpec().tick(millis, mockDate.tick);
}

function flushInternal() {
  if (fixture != null) {
    getFixture().detectChanges();
  }

  // Recursivey flush non-periodic as well as periodic timers while advancing
  // the mock Date at each individual step.
  getFakeAsyncTestZoneSpec().flush(20, true, mockDate.tick);

  // Do a change detection for changes that might have occurred in the
  // flushed tasks.
  if (fixture != null) {
    getFixture().detectChanges();
  }
}

function nowInternal<T>(fn: () => T | Promise<T>): T {
  let retVal: T|null = null;
  if (fixture != null) {
    // Run the function in the NgZone so that the NgZone becomes unstable,
    // which will trigger change detection.
    TestBed.inject(NgZone).run(async () => {
      retVal = await fn();
    });
  } else {
    // There is no NgZone that has been bootstrapped yet.
    // Just run the fn in the fakeAsyncZone.
    getFakeAsyncZone().run<Promise<void>>(async () => {
      retVal = await fn();
    });
  }
  flushMicroTasks();
  return retVal!;
}

/** Get the injected instance for the given InjectionToken. */
export function get<T>(token: InjectionToken<T>): T;
/** Get the injected instance for the given concrete class. */
export function get<T>(token: Type<T>): T;
/** Get the injected instance for the given abstract class. */
export function get<T>(token: AbstractType<T>): T;
/**
 * Get the injected instance for the string token. This value must be casted
 * because we cannot know the type at compile time.
 */
export function get(token: string): unknown;
/**
 * Get the injected object instance for the given 'token'.
 * @param token token to be injected
 */
// tslint:disable-next-line:no-any get can inject multiple tokens
export function get(token: any) {
  // The first injection might run app initializers which might be async in
  // nature.
  assertIsInCatalyst('Put get() inside beforeEach, beforeAll or it.');
  return now(() => {
    compileComponents();
    return TestBed.inject(token);
  });
}

function getElInternal<T extends Element = HTMLElement>(
    selector?: string, root?: ParentNode): T {
  root = root ? root : getFixture().nativeElement as HTMLElement;
  const retVal = selector ? root.querySelector(selector) : root;
  if (!retVal) {
    throw new Error('Element not found for "' + selector + '"');
  }
  return retVal as T;
}

function getElsInternal<T extends Element = HTMLElement>(
    selector?: string, root?: ParentNode): T[] {
  root = root ? root : getFixture().nativeElement as HTMLElement;
  // TODO: remove non-null assertion.
  return Array.from(root.querySelectorAll(selector!));
}

function hasElInternal(selector: string, root?: ParentNode): boolean {
  return getEls(selector, root).length !== 0;
}

/**
 * Coerce a query input into a predicate that can be used for finding debug
 * elements.
 *
 * @param query Either a CSS selector or a directive type
 */
function getDebugElPredicate(query: Type<unknown>|string) {
  return typeof query === 'string' ? By.css(query) : By.directive(query);
}

// tslint:disable-next-line:no-return-only-generics
function getDebugElInternal<T, N extends Element>(
    query?: Type<T>|string, root?: DebugElement): TypedDebugElement<T, N> {
  root = root || getFixture().debugElement;
  if (!query) {
    return root as TypedDebugElement<T, N>;
  }

  const debugElement = root.query(getDebugElPredicate(query));
  if (!debugElement) {
    throw new Error(`DebugElement not found for "${query}"`);
  }
  return debugElement as TypedDebugElement<T, N>;
}

// tslint:disable-next-line:no-return-only-generics
function getDebugElsInternal<T, N extends Element>(
    query: Type<T>|string,
    root?: DebugElement): Array<TypedDebugElement<T, N>> {
  root = root || getFixture().debugElement;
  const debugElements = root.queryAll(getDebugElPredicate(query));
  return debugElements as Array<TypedDebugElement<T, N>>;
}

/**
 * Interface to reduce casting of the component instance of a DebugElement.
 */
export interface TypedDebugElement<T, N extends Element = HTMLElement> extends
    DebugElement {
  componentInstance: T;

  nativeElement: N;
}

function internalHasDebugEl(
    query: Type<unknown>|string, root?: DebugElement): boolean {
  root = root ? root : getFixture().debugElement;
  const debugElements = root.queryAll(getDebugElPredicate(query));
  return debugElements.length !== 0;
}

/**
 * Destroys the test component.
 *
 * This is useful when you need to test component destruction but you cannot
 * call ngOnInit directly (this can happen if you using structural directives
 * that do not render on the page). Note that there is no going back from this.
 */
export function destroyTestComponent() {
  getFixture().destroy();
  fixture = null;
}

/**
 * Event types to generate a MouseEvent instead of a regular Event.
 */
const MOUSE_EVENTS = [
  'click', 'dblclick', 'mousedown', 'mousemove', 'mouseout', 'mouseover',
  'mouseup'
];

/**
 * Event types to generate a KeyboardEvent instead of a regular Event.
 */
const KEYBOARD_EVENTS = ['keydown', 'keypress', 'keyup'];

function triggerInternal(
    el: EventTarget, eventType: keyof HTMLElementEventMap,
    eventParam?: KeyboardEventInit, extraParams?: {[eventProp: string]: {}}) {
  let event;
  if (MOUSE_EVENTS.indexOf(eventType) !== -1) {
    event = document.createEvent('MouseEvents');
  } else if (KEYBOARD_EVENTS.indexOf(eventType) !== -1 && eventParam) {
    event = new KeyboardEvent(eventType, eventParam);
  } else {
    event = document.createEvent('HTMLEvents');
  }
  if (extraParams) {
    // Direct assignments to the event object don't work, as some properties are
    // readonly. Object.defineProperty is used to overwrite them.
    for (const property of Object.keys(extraParams)) {
      Object.defineProperty(event, property, {'value': extraParams[property]});
    }
  }
  event.initEvent(eventType, true /* bubbles */, true /* cancelable */);
  el.dispatchEvent(event);
  return event;
}

/**
 * Set up Ng1 Module based on Ng2 NgModule class.
 *
 * @param ng1Module ng1 module's name
 * @param ng2Module ng2 NgModule class
 * @param cachedTemplateModuleName optional, if ng1 component uses templateUrl
 *   to load template, cachedTemplateModuleName should be specified for test to
 *   load template The template module's name  can be achieved by: import
 *   {templates} from {your template bundle}; templates.name
 * @param configFn optional, extra config function for creating ng1 module.
 *   It usually looks like:
 *   ($provide: ng.auto.IProvideService) => {
 *     $provide.value('$rootElement', root);
 *   }
 */
export function setupNg1Module<T>(
    ng1Module: string, ng2Module: Type<T>, cachedTemplateModuleName?: string,
    // tslint:disable-next-line:no-any configFn can inject multiple tokens
    configFn?: (...args: any[]) => void): void {
  // Destroy the original platform first. Compiling a ng1 component that
  // contains ng2 component will implicitly create a new platform
  destroyPlatform();
  const ng2 = downgradeModule(ng2Module);
  if (configFn) {
    angular.mock.module(ng1Module, configFn, ng2);
  } else {
    angular.mock.module(ng1Module, ng2);
  }
  if (cachedTemplateModuleName) {
    angular.mock.module(cachedTemplateModuleName);
    angular.mock.module(($provide: angular.auto.IProvideService) => {
      $provide.value('forceCachedTemplates', true);
    });
  }
}

/**
 * Compile and create Ng1 component
 * Must be called after setupNg1Module
 *
 * @param ng1Componentselector     ng1 component's selector which is used to
 * locate ng1 component. e.g. "<ng1-component></ng1-component>"
 * @param $scope  optional  scope used to compile component. If not specified,
 * it will create a new scope based on rootscope
 * Note that if your tests create your own scope and use it to do your tests,
 * you should pass it to the function rather than creating a new scope, which
 * will cause problems due to scope mismatch
 * @return AngularJS element created
 */
export function compileNg1Component(
    ng1Componentselector: string,
    $scope?: angular.IScope): angular.IAugmentedJQuery {
  const element = angular.element(ng1Componentselector);
  angular.mock.inject(
      ($rootScope: angular.IRootScopeService, $compile: angular.ICompileService,
       $templateCache: angular.ITemplateCacheService) => {
        const scope = $scope || $rootScope.$new();
        // Angular 1 compilation will trigger Angular 2 module bootstrap,
        // which is asynchronous. Wrap it with Catalyst now() to make it
        // run synchronously
        now(() => {
          $compile(element)(scope);
        });
        now(() => {
          scope.$apply();
        });
        // Extra scope.apply is needed when compiling AngularJS from template
        // url. This is because when using a template url, the angular2 module
        // bootstrap will be triggered during the first scope.$apply(). There is
        // a deferred function in downgradeComponent, which run scope.$digest()
        // to get extra information, e.g. binding from ng1 component in async
        // way. It will work in normal app, but Angular mock rewrites
        // $browser.defer and the deferred function won't run in test and we
        // have to call scope.$apply() manually.
        scope.$apply();
      });
  return element;
}

/**
 * Create AngularJS component from an AngularJS module which uses an Angular(2+)
 * downgraded module.
 * This is a convenience wrapper around setupNg1Module and compileNg1Component.
 * If you need better flexibility, please use them separately.
 *
 * @param ng1Module ng1 module's name
 * @param ng1Componentselector ng1 component's selector which is used to
 * locate ng1 component. e.g. "<ng1-component></ng1-component>"
 * @param ng2Module ng2 NgModule class reference
 * @param cachedTemplateModuleName optional, if ng1 component uses templateUrl
 * to load template, cachedTemplateModuleName should be specified for test to
 * load template The template module's name  can be achieved by: import
 * {templates} from {your template bundle}; templates.name
 * @return AngularJS element created
 */
export function createNg1Component<T>(
    ng1Module: string,
    ng1Componentselector: string,
    ng2Module: Type<T>,
    cachedTemplateModuleName?: string,
    ): angular.IAugmentedJQuery {
  setupNg1Module(ng1Module, ng2Module, cachedTemplateModuleName);
  return compileNg1Component(ng1Componentselector);
}

function isInFakeAsyncZone() {
  return Zone.current.get('FakeAsyncTestZoneSpec') != null;
}

function callInFakeAsyncZone<T>(fn: () => T): T {
  if (isInFakeAsyncZone()) {
    return fn();
  } else {
    return getFakeAsyncZone().run<T>(fn);
  }
}

function createComponent<T>(
    component: Type<T>, inputs: Partial<T> = {},
    beforeChangeDetection?: (comp: T) => void, flush = true): T {
  return callInFakeAsyncZone(
      () => createComponentInternal(
          component, inputs, beforeChangeDetection, flush));
}

function flushMicroTasks() {
  // This is a workaround for tests that fail outside of the context of that
  // test. This seems to happen when there are tasks that escape the fakeAsync
  // zone(Ex. Animations) and the flushMicrotasks is called after all the setup
  // including the fakeAsync zone have been cleaned up. For now just ignore it.
  if (!zoneInitialized) {
    return;
  }
  return callInFakeAsyncZone(() => {
    getFakeAsyncTestZoneSpec().flushMicrotasks();
  });
}

function assertIsInCatalyst(msg: string = '') {
  if (!inCatalyst) {
    throw new Error(
        msg + ` Remember to import 'it', 'beforeEach', 'afterEach' etc. ` +
        `from the catalyst module.`);
  }
}

/**
 * Setup the Angular 2+ NgModule for the test.
 * If you want to setup AngularJS Module that uses Angular2 downgraded Module,
 * Please use setupNg1Module
 */
export function setupModule(config: ModuleConfig) {
  assertIsInCatalyst('Put setupModule() inside beforeEach or beforeAll.');
  return callInFakeAsyncZone(() => setupModuleInternal(config));
}

/**
 * Bootstrap a root Component for testing.
 *
 * @param component too component bootstrapped for the test
 * @param inputs component @Input values
 * @param beforeChangeDetection function to be run after component instance is
 *                              created but before first change detection is run
 * @param flush whether to flush tasks after bootstrapping. Defaults to `true`.
 * @return root component instance
 */
export function bootstrap<T>(
    component: Type<T>, inputs: Partial<T> = {},
    beforeChangeDetection?: (comp: T) => void, flush = true): T {
  assertIsInCatalyst('Put bootstrap() inside beforeEach, beforeAll or it.');
  return callInFakeAsyncZone(
      () => bootstrapInternal(component, inputs, beforeChangeDetection, flush));
}

/**
 * Bootstrap a dynamic test Component from a template string.
 *
 * The test component is created on the fly from a combination of the template
 * string and a map with properties referenced in the template. Only keys that
 * are present in the map as it is passed on to the function are observed
 * throughout the lifetime of the component.
 * Ex.
 * bootstrapTemplate(
 *     `<test-component [name]="testName"></test-component>`,
 *     {testName: 'John'});
 * creates a dynamic component that instantiates the component under test
 * with the specified 'testName' property passed in as binding for the 'name'
 * attribute.
 *
 * @param templateString template for root component.
 * @param instance instance object backing the root component.
 * @param beforeChangeDetection function to be run after component instance is
 * created but before first change detection is run.
 * @param flush whether to flush tasks after bootstrapping. Defaults to `true`.
 * @return root component instance
 */
export function bootstrapTemplate<T extends {} = {}>(
    templateString: string, instance: Partial<T> = {},
    beforeChangeDetection?: (comp: T) => void, flush = true): T {
  assertIsInCatalyst(
      'Put bootstrapTemplate() inside beforeEach, beforeAll or it.');
  return callInFakeAsyncZone(
      () => bootstrapTemplateInternal(
          templateString, instance, beforeChangeDetection, flush));
}

/**
 * Simulate passage of time to trigger setTimeout and setInterval events.
 * Any change in state in the event handlers is reflected in the DOM.
 *
 * @param millis time to advance in milliseconds
 */
export function tick(millis: number): void {
  assertIsInCatalyst(
      'Put tick() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  callInFakeAsyncZone(() => {
    tickInternal(millis);
  });
}

/**
 * Flush all tasks and currently queued timers.
 * Helpful in triggering timers without knowing how long they are waiting for.
 */
export function flush() {
  assertIsInCatalyst(
      'Put flush() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  callInFakeAsyncZone(flushInternal);
}

/**
 * Flush which works on components with OnPush change detection strategy.
 */
export function markForCheckAndFlush() {
  const cdr =
      getDebugEl().injector.get(ChangeDetectorRef as Type<ChangeDetectorRef>);
  cdr.markForCheck();
  flush();
}

/**
 * Synchronously execute the specified function and reflects any changes made
 * to the component to the DOM.
 *
 * Executes the function synchronously even if it is asynchronous by executing
 * it in a Zone where task queue can be emptied synchronously.
 *
 * @param fn function to execute
 * @return return value of 'fn' converting Promises to immediate values
 */
export function now<T>(fn: () => T | Promise<T>): T {
  assertIsInCatalyst(
      'Put now() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  return callInFakeAsyncZone(() => nowInternal(fn));
}

/** {@see getEl} */
export function getEl<K extends keyof HTMLElementTagNameMap>(
    tagName: K, root?: ParentNode): HTMLElementTagNameMap[K];
/** {@see getEl} */
export function getEl<K extends keyof SVGElementTagNameMap>(
    tagName: K, root?: ParentNode): SVGElementTagNameMap[K];
/** {@see getEl} */
export function getEl<T extends Element = HTMLElement>(
    selector?: string, root?: ParentNode): T;

/**
 * Helper function to locate first HTML element under the root test element
 * given the CSS selector.
 *
 * Throws an exception if element is not found.
 *
 * @param selector CSS selector
 * @param root root element to select within, defaults to fixture root
 * @return the HTML Element if found. Throws an Exception otherwise
 */
export function getEl<T extends Element = HTMLElement>(
    selector?: string, root?: ParentNode): T {
  assertIsInCatalyst(
      'Put getEl() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  return callInFakeAsyncZone(() => getElInternal(selector, root));
}

/** {@see getEls} */
export function getEls<K extends keyof HTMLElementTagNameMap>(
    tagName: K, root?: ParentNode): Array<HTMLElementTagNameMap[K]>;
/** {@see getEls} */
export function getEls<K extends keyof SVGElementTagNameMap>(
    tagName: K, root?: ParentNode): Array<SVGElementTagNameMap[K]>;
/** {@see getEls} */
export function getEls<T extends Element = HTMLElement>(
    selector?: string, root?: ParentNode): T[];

/**
 * Helper function to locate all HTML elements under the root test element given
 * the CSS selector.
 *
 * @param selector CSS selector
 * @param root root element to select within, defaults to fixture root
 * @return the HTML Element if found. Throws an Exception otherwise
 */
export function getEls<T extends Element = HTMLElement>(
    selector?: string, root?: ParentNode): T[] {
  assertIsInCatalyst(
      'Put getEls() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  return callInFakeAsyncZone(() => getElsInternal(selector, root));
}

/**
 * Return whether an element with the specified CSS selector is present.
 *
 * @param selector CSS selector
 * @param root root element to select within, defaults to fixture root
 */
export function hasEl(selector: string, root?: ParentNode): boolean {
  assertIsInCatalyst(
      'Put hasEl() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  return callInFakeAsyncZone(() => hasElInternal(selector, root));
}

/**
 * Get the root TypedDebugElement for this test. If bootstrap was used this
 * will be the DebugElement of the component bootstraped, if bootstrapTemplate
 * was used this will be the DebugElement of the root test component.
 */
// tslint:disable-next-line:no-any
export function getDebugEl<T = any, N extends Element = HTMLElement>():
    TypedDebugElement<T, N>;

/** {@see getDebugEl} */
export function getDebugEl<T>(
    query: Type<T>, root?: DebugElement): TypedDebugElement<T, HTMLElement>;

/** {@see getDebugEl} */
export function getDebugEl<N extends keyof HTMLElementTagNameMap>(
    tagName: N,
    root?: DebugElement): TypedDebugElement<unknown, HTMLElementTagNameMap[N]>;

/** {@see getDebugEl} */
export function getDebugEl<N extends keyof SVGElementTagNameMap>(
    tagName: N,
    root?: DebugElement): TypedDebugElement<unknown, SVGElementTagNameMap[N]>;

/** {@see getDebugEl} */
// tslint:disable-next-line:no-any
export function getDebugEl<T = any, N extends Element = HTMLElement>(
    query?: Type<T>|string, root?: DebugElement): TypedDebugElement<T, N>;

/**
 * Helper function to locate first Angular DebugElement under root test
 * element matching the given directive type or CSS selector.
 *
 * @param query directive type or CSS selector string
 * @param root root element to select within, defaults to fixture root
 * @return first matching DebugElement
 */
export function getDebugEl<T, N extends Element = HTMLElement>(
    query?: Type<T>|string, root?: DebugElement): TypedDebugElement<T, N> {
  assertIsInCatalyst(
      'Put getDebugEl() inside beforeEach, beforeAll, it, afterAll ' +
      'or afterEach.');
  return callInFakeAsyncZone(() => getDebugElInternal<T, N>(query, root));
}

/** {@see getDebugEls} */
export function getDebugEls<T>(query: Type<T>, root?: DebugElement):
    Array<TypedDebugElement<T, HTMLElement>>;

/** {@see getDebugEls} */
export function getDebugEls<N extends keyof HTMLElementTagNameMap>(
    tagName: N, root?: DebugElement):
    Array<TypedDebugElement<unknown, HTMLElementTagNameMap[N]>>;

/** {@see getDebugEls} */
export function getDebugEls<N extends keyof SVGElementTagNameMap>(
    tagName: N, root?: DebugElement):
    Array<TypedDebugElement<unknown, SVGElementTagNameMap[N]>>;

/** {@see getDebugEls} */
// tslint:disable-next-line:no-any
export function getDebugEls<T = any, N extends Element = HTMLElement>(
    query: Type<T>|string, root?: DebugElement): Array<TypedDebugElement<T, N>>;

/**
 * Helper function to locate all Angular DebugElements under root test element
 * matching the given directive type or CSS selector.
 *
 * @param query directive type or CSS selector string
 * @param root root element to select within, defaults to fixture root
 * @return array of all matching DebugElement-s
 */
export function getDebugEls<T, N extends Element = HTMLElement>(
    query: Type<T>|string,
    root?: DebugElement): Array<TypedDebugElement<T, N>> {
  assertIsInCatalyst(
      'Put getDebugEls() inside beforeEach, beforeAll, it, afterAll ' +
      'or afterEach.');
  return callInFakeAsyncZone(() => getDebugElsInternal<T, N>(query, root));
}

/**
 * Helper function to determine whether an element with the given
 * directive or CSS selector exists.
 *
 * @return `true` if DebugElement with given type is found. `false` otherise
 */
export function hasDebugEl(
    query: Type<unknown>|string, root?: DebugElement): boolean {
  assertIsInCatalyst(
      'Put hasDebugEl() inside beforeEach, beforeAll, it, afterAll ' +
      'or afterEach.');
  return callInFakeAsyncZone(() => internalHasDebugEl(query, root));
}

/**
 * Helper function to trigger HTMLElementEvent on a provided element.
 *
 * When the eventType is one of KeyboardEvent types, an additional eventParam
 * must represent a map that fits into KeyboardEventInit instance, followed
 * by extra parameters that are not covered in KeyboardEventInit. Of particular
 * highlight is the keyCode property, which is not part of KeyboardEventInit
 * (https://github.com/Microsoft/TypeScript/issues/15228). When a KeyboardEvent
 * is created with a properly populated KeyboardEventInit, the keyCode won't be
 * populated (https://bugs.webkit.org/show_bug.cgi?id=16735).
 * An example use:
 *
 *     trigger(el, 'keydown', {key: 'Enter'}, {'keyCode': 13});
 *
 * @return The event that was triggered.
 */
export function trigger(
    el: EventTarget, eventType: keyof HTMLElementEventMap,
    eventParam?: KeyboardEventInit,
    extraParams?: {[eventProp: string]: {}}): Event {
  assertIsInCatalyst(
      'Put trigger() inside beforeEach, beforeAll, it, afterAll or afterEach.');
  return callInFakeAsyncZone(
      () => triggerInternal(el, eventType, eventParam, extraParams));
}
