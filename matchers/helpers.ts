import 'jasmine';
import {flush as fakeAsyncFlush} from '@angular/core/testing';
import {flush, isInCatalyst, now} from '../helpers';
import {Observable, Subscription} from 'rxjs';

/**
 * Returns sequence of values emitted by observable. Should be used inside of a
 * test wrapped with fakeAsync or in catalyst tests.
 *
 * Does not handle exceptions, completions, and delayed results.
 *
 * This function awaits and executes asynchronously, so it can potentially mask
 * asynchronous vs synchronous values. For more explicit synchronous behavior,
 * see {@link immediatelyGetValues}.
 *
 * Usage:
 *   awaitValues(someObservable)
 *
 * Throws an exception if used outside of FakeAsyncZone or SyncZone.
 *
 * @see immediatelyGetValues
 */
export function awaitValues<T>(observable: Observable<T>): T[] {
  const vals: T[] = [];
  const subscriptions: Subscription[] = [];

  executeAsyncInCurrentZone(() => {
    subscriptions.push(observable.subscribe(val => {
      vals.push(val);
    }));
  });

  for (const subscription of subscriptions) {
    subscription.unsubscribe();
  }

  return vals;
}

/**
 * Returns synchronous sequence of values immediately emitted by observable upon
 * subscription.
 *
 * Does not handle exceptions, completions, and delayed results.
 *
 * Usage:
 *   immediatelyGetValues(someObservable)
 *
 * @see awaitValues
 */
export function immediatelyGetValues<T>(observable: Observable<T>): T[] {
  const vals: T[] = [];
  let maybeError: Error|undefined;
  observable
      .subscribe(
          next => {
            vals.push(next);
          },
          error => {
            maybeError = error;
          })
      .unsubscribe();
  if (maybeError) {
    throw new Error(
        `Expected not to throw error but did! Cause: ${maybeError}`);
  }
  return vals;
}

/**
 * Flushes all tasks and currently queued timers. Supports both Sync and
 * FakeAsync zones.
 */
export function flushAllInCurrentZone() {
  if (isInCatalyst()) {
    flush();
  } else {
    fakeAsyncFlush();
  }
}

/**
 * Executes async code in current zone. Supports both Sync and FakeAsync zones.
 */
export function executeAsyncInCurrentZone(fn: () => void) {
  if (isInCatalyst()) {
    now(fn);
  } else {
    fn();
  }
  flushAllInCurrentZone();
}

/**
 * This handles conditionally displaying the results of jasmine.diffBuilder.
 *
 * There are 2 potential cases here:
 * - For primitive values this is redundant, so we drop it
 * - For comparing Objects to Object and Array to Array we return it as it.
 */
export function extraInfo(info: string, expected: unknown, actual: unknown) {
  const areBothArrays = Array.isArray(expected) && Array.isArray(actual);
  const areBothObjects =
      Object.prototype.toString.call(expected) === '[object Object]' &&
      Object.prototype.toString.call(actual) === '[object Object]';

  if (areBothArrays || areBothObjects) {
    return info;
  }
  return '';
}
