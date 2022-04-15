import {Observable, of} from 'rxjs';
import {catchError, filter, map} from 'rxjs/operators';

import {awaitValues, executeAsyncInCurrentZone, extraInfo, immediatelyGetValues} from './helpers';

declare global {
  namespace jasmine {
    interface Matchers<T> {
      // For Observable:
      toEmit(value: {}|null|undefined): void;
      toEmitImmediately(value: {}|null|undefined): void;
      toHaveNeverEmitted(): void;
      toHaveEmitted(): void;
      toEmitError(value: {}|null|undefined): void;
      toEmitErrorImmediately(value: {}|null|undefined): void;
      toEmitSequence(value: {}): void;
      toEmitSequenceImmediately(value: {}): void;

      // For Promise:
      toResolveWith(value: {}|null|undefined): void;
      toRejectWith(value: {}|null|undefined): void;
      /**
       * Similar to toRejectWith but expects the rejection to be with an object
       * of type Error.
       *
       * If expectedMessage is provided then the Error must have a message
       * property that:
       *
       * * is equal to the expectedMessage if it is a string.
       * * fully matches expectedMessage if it is a RegExp.
       */
      toRejectWithError(expectedMessage?: string|RegExp|null): void;
      toBePending(): void;
    }
  }
}

const asyncMatchersRaw: jasmine.CustomMatcherFactories = {
  /**
   * Checks to see if observable emits provided value. Fails if multiple values
   * emitted.
   *
   * Throws an exception if used outside of FakeAsyncZone or SyncZone.
   *
   * @see toEmitImmediately
   */
  toEmit(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedValue: T) {
        return expectOne({
          actualValues: awaitValues(actual),
          expectedValue,
          valueNoun: 'value',
          util,
          customEqualityTesters,
        });
      }
    };
  },

  /**
   * Checks to see if observable emits provided value immediately. Fails if
   * multiple values are emitted or if something would have been emitted
   * asynchronously.
   *
   * @see toEmit
   */
  toEmitImmediately(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedValue: T) {
        return expectOne({
          actualValues: immediatelyGetValues(actual),
          expectedValue,
          valueNoun: 'value',
          util,
          customEqualityTesters,
        });
      }
    };
  },

  /**
   * Checks to see that an observable has not emitted. Fails if the observable
   * has emitted anything.
   *
   * @see toEmit
   */
  toHaveNeverEmitted(util: jasmine.MatchersUtil): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedValue: T) {
        return expectNone(
            {actualValues: awaitValues(actual), valueNoun: 'value', util});
      }
    };
  },

  /**
   * Checks to see that an observable has emitted. Fails if the observable
   * has never emitted anything.
   *
   * @see toEmit
   */
  toHaveEmitted(util: jasmine.MatchersUtil): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedValue: T) {
        return expectAny(
            {actualValues: awaitValues(actual), valueNoun: 'value', util});
      }
    };
  },

  /**
   * Checks to see if observable emits an error with provided value. Fails if
   * multiple values emitted.
   *
   * Throws an exception if used outside of FakeAsyncZone or SyncZone.
   *
   * @see toEmitErrorImmediately
   */
  toEmitError(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare: <T>(actual: Observable<T>, expectedError: T) => {
        return expectOne({
          actualValues: awaitValues(mapErrorsToValues(actual)),
          expectedValue: expectedError,
          valueNoun: 'error',
          util,
          customEqualityTesters,
        });
      }
    };
  },

  /**
   * Checks to see if observable immediately emits an error with provided value.
   * Fails if multiple are emitted.
   *
   * @see toEmitError
   */
  toEmitErrorImmediately(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedError: T) {
        return expectOne({
          actualValues: immediatelyGetValues(mapErrorsToValues(actual)),
          expectedValue: expectedError,
          valueNoun: 'error',
          util,
          customEqualityTesters,
        });
      }
    };
  },

  /**
   * Checks to see if observable emits provided values in specified order.
   *
   * Throws an exception if used outside of FakeAsyncZone or SyncZone.
   *
   * @see toEmitSequenceImmediately
   */
  toEmitSequence(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedValues: T[]) {
        return expectAll({
          actualValues: awaitValues(actual),
          expectedValues,
          valuesNoun: 'values',
          util,
          customEqualityTesters,
        });
      }
    };
  },

  /**
   * Checks to see if observable immediately emits provided values in specified
   * order.
   *
   * @see toEmitSequence
   */
  toEmitSequenceImmediately(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Observable<T>, expectedValues: T[]) {
        return expectAll({
          actualValues: immediatelyGetValues(actual),
          expectedValues,
          valuesNoun: 'values',
          util,
          customEqualityTesters,
        });
      }
    };
  },

  toResolveWith(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Promise<T>, expected: T): jasmine.CustomMatcherResult {
        const promiseResult = analyzePromiseResult(actual);
        if (promiseResult.resolution !== PromiseResolution.RESOLVED) {
          return nonResolvedResultToMatcherResult(util, promiseResult);
        }

        const builder = jasmine.DiffBuilder();
        const pass = util.equals(
            promiseResult.resolvedValue,
            expected,
            customEqualityTesters,
            builder,
        );

        const not = pass ? 'not ' : '';

        return {
          pass,
          message: `Expected ${not}to resolve with: ${
              prettyPrint(util, expected)} but resolved with: ${
              prettyPrint(util, promiseResult.resolvedValue)}${
              extraInfo(
                  builder.getMessage(),
                  promiseResult.resolvedValue,
                  expected,
                  )}`,

        };
      }
    };
  },

  toRejectWith(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Promise<T>, expected: {}|null|undefined):
          jasmine.CustomMatcherResult {
            const promiseResult = analyzePromiseResult(actual);
            if (promiseResult.resolution !== PromiseResolution.REJECTED) {
              return nonRejectedResultToMatcherResult(util, promiseResult);
            }

            const builder = jasmine.DiffBuilder();
            const pass = util.equals(
                promiseResult.rejectedValue,
                expected,
                customEqualityTesters,
                builder,
            );

            const not = pass ? 'not ' : '';
            return {
              pass,
              message: `Expected ${not}to reject with: ${
                  prettyPrint(util, expected)} but rejected with: ${
                  prettyPrint(util, promiseResult.rejectedValue)}${
                  extraInfo(
                      builder.getMessage(),
                      promiseResult.rejectedValue,
                      expected,
                      )}`,

            };
          }
    };
  },

  toRejectWithError(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(
          actual: Promise<T>,
          expectedMessage?: string|RegExp|null): jasmine.CustomMatcherResult {
        const promiseResult = analyzePromiseResult(actual);
        if (promiseResult.resolution !== PromiseResolution.REJECTED) {
          return nonRejectedResultToMatcherResult(util, promiseResult);
        }

        if (!(promiseResult.rejectedValue instanceof Error)) {
          return {
            pass: false,
            message:
                `Expected promise to reject with an Error but rejected with: ${
                    prettyPrint(util, promiseResult.rejectedValue)}`,
          };
        }

        if (expectedMessage === undefined || expectedMessage === null) {
          // No further checks
          return {
            pass: true,
          };
        }

        if (typeof expectedMessage === 'string') {
          const pass = util.equals(
              promiseResult.rejectedValue.message,
              expectedMessage,
              customEqualityTesters,
          );

          const not = pass ? 'not ' : '';
          return {
            pass,
            message:
                `Expected ${not}to reject with an Error that has the message: ${
                    prettyPrint(util, expectedMessage)} but rejected with: ${
                    prettyPrint(util, promiseResult.rejectedValue)}`,
          };
        }

        // If we are here, expectedMessage is a RegExp
        const pass = expectedMessage.test(promiseResult.rejectedValue.message);
        const not = pass ? 'not ' : '';
        return {
          pass,
          message: `Expected ${not}to reject with an Error that has the ` +
              `message that matches the RegExp: ${
                       prettyPrint(util, expectedMessage)} but rejected with: ${
                       prettyPrint(util, promiseResult.rejectedValue)}`,
        };
      }
    };
  },

  toBePending(
      util: jasmine.MatchersUtil,
      customEqualityTesters: readonly jasmine.CustomEqualityTester[],
      ): jasmine.CustomMatcher {
    return {
      compare<T>(actual: Promise<T>, expected: T): jasmine.CustomMatcherResult {
        const promiseResult = analyzePromiseResult(actual);
        if (promiseResult.resolution !== PromiseResolution.STILL_PENDING) {
          return nonPendingResultToMatcherResult(util, promiseResult);
        }

        return {
          pass: true,
          message: `Expected to be pending`,

        };
      }
    };
  },
};

// Having it like this allows us to have the exact types being used by the
// asyncMatchers available in the test.
export const TEST_ONLY = {asyncMatchersRaw};

/** A bunch of CustomMatcherFactories useful for testing async results. */
export const asyncMatchers: jasmine.CustomMatcherFactories = asyncMatchersRaw;

/** Enum used to discriminate between the different types of PromiseResult. */
enum PromiseResolution {
  STILL_PENDING,
  RESOLVED,
  REJECTED,
}

interface PromiseStillPending {
  resolution: PromiseResolution.STILL_PENDING;
}

interface PromiseResolved<T> {
  resolution: PromiseResolution.RESOLVED;
  resolvedValue: T|undefined;
}

interface PromiseRejected {
  resolution: PromiseResolution.REJECTED;
  rejectedValue: {}|undefined|null;
}

type PromiseResult<T> = PromiseStillPending|PromiseResolved<T>|PromiseRejected;
type NonRejectedResult<T> = PromiseStillPending|PromiseResolved<T>;
type NonResolvedResult = PromiseStillPending|PromiseRejected;
type NonPendingResult<T> = PromiseResolved<T>|PromiseRejected;

/**
 * Analyzes a Promise and returns whether it was resolved, rejected or it is
 * still pending. When it was resolved or rejected, then the corresponding value
 * is included in the returned object.
 */
function analyzePromiseResult<T>(promise: Promise<T>): PromiseResult<T> {
  let result: PromiseResult<T> = {
    resolution: PromiseResolution.STILL_PENDING,
  };

  executeAsyncInCurrentZone(() => {
    promise
        .then((val) => {
          result = {
            resolution: PromiseResolution.RESOLVED,
            resolvedValue: val,
          };
        })
        .catch((val) => {
          result = {
            resolution: PromiseResolution.REJECTED,
            rejectedValue: val,
          };
        });
  });
  return result;
}

/**
 * Converts a NonResolvedResult into a CustomMatcherResult with the appropriate
 * error message. It is intended to be used on a Promise that should have been
 * resolved, but it wasn't.
 */
function nonResolvedResultToMatcherResult(
    util: jasmine.MatchersUtil,
    promiseResult: NonResolvedResult): jasmine.CustomMatcherResult {
  switch (promiseResult.resolution) {
    case PromiseResolution.STILL_PENDING:
      return {
        pass: false,
        message: 'Expected promise to resolve, but it is still pending.',
      };
    case PromiseResolution.REJECTED:
      return {
        pass: false,
        message: `Expected promise to resolve, but it rejected with: ${
            prettyPrint(util, promiseResult.rejectedValue)}`,
      };
    default:
      throw new Error(`Unexpected PromiseResolution in PromiseResult: ${
          prettyPrint(util, promiseResult)}`);
  }
}

/**
 * Converts a NonRejectedResult into a CustomMatcherResult with the appropriate
 * error message. It is intended to be used on a Promise that should have been
 * rejected, but it wasn't.
 */
function nonRejectedResultToMatcherResult<T>(
    util: jasmine.MatchersUtil,
    promiseResult: NonRejectedResult<T>): jasmine.CustomMatcherResult {
  switch (promiseResult.resolution) {
    case PromiseResolution.STILL_PENDING:
      return {
        pass: false,
        message: 'Expected promise to reject, but it is still pending.',
      };
    case PromiseResolution.RESOLVED:
      return {
        pass: false,
        message: `Expected promise to reject, but it resolved with: ${
            prettyPrint(util, promiseResult.resolvedValue)}`,
      };
    default:
      throw new Error(`Unexpected PromiseResolution in PromiseResult: ${
          prettyPrint(util, promiseResult)}`);
  }
}

/**
 * Converts a NonPendingResult into a CustomMatcherResult with the appropriate
 * error message. It is intended to be used on a Promise that should bave been
 * pending, but it wasn't.
 */
function nonPendingResultToMatcherResult<T>(
    util: jasmine.MatchersUtil,
    promiseResult: NonPendingResult<T>): jasmine.CustomMatcherResult {
  switch (promiseResult.resolution) {
    case PromiseResolution.RESOLVED:
      return {
        pass: false,
        message: `Expected promise to be pending, but it resolved with: ${
            prettyPrint(util, promiseResult.resolvedValue)}`,
      };
    case PromiseResolution.REJECTED:
      return {
        pass: false,
        message: `Expected promise to be pending, but it rejected with: ${
            prettyPrint(util, promiseResult.rejectedValue)}`,
      };
    default:
      throw new Error(`Unexpected PromiseResolution in PromiseResult: ${
          prettyPrint(util, promiseResult)}`);
  }
}

function mapErrorsToValues<V>(obs: Observable<V>) {
  // Ignore all values and map type to same as returned by catchError.
  return obs.pipe(
      filter(() => false),
      map(() => ({})),
      catchError((val: {}|null|undefined) => of(val)),
  );
}

function expectNone<T>(args: {
  actualValues: T[],
  valueNoun: string,
  util: jasmine.MatchersUtil,
}): jasmine.CustomMatcherResult {
  const len = args.actualValues.length;
  if (len !== 0) {
    return {
      pass: false,
      message: `Expected observable not to emit ${args.valueNoun}, but got ${
          len} ${len === 1 ? 'value' : 'values'} instead: "${
          prettyPrint(args.util, args.actualValues)}"`
    };
  } else {
    return {
      pass: true,
      message: `Expected observable to emit at least one value`
    };
  }
}

function expectAny<T>(args: {
  actualValues: T[],
  valueNoun: string,
  util: jasmine.MatchersUtil,
}): jasmine.CustomMatcherResult {
  if (args.actualValues.length) {
    return {
      pass: true,
      message: `Expected observable to emit at least one value`
    };
  } else {
    return {
      pass: false,
      message: `Expected observable to emit at least one value, but got none.`
    };
  }
}

function expectOne<T>(args: {
  actualValues: T[],
  expectedValue: T,
  valueNoun: string,
  util: jasmine.MatchersUtil,
  customEqualityTesters: readonly jasmine.CustomEqualityTester[],
}): {pass: boolean, message: string} {
  const len = args.actualValues.length;
  if (len !== 1) {
    return {
      pass: false,
      message: `Expected observable to emit one ${args.valueNoun}, but got ${
          len} values instead: "${prettyPrint(args.util, args.actualValues)}"`
    };
  }

  const builder = jasmine.DiffBuilder();
  const actualValue = args.actualValues[0];
  const pass = args.util.equals(
      actualValue,
      args.expectedValue,
      args.customEqualityTesters,
      builder,
  );

  return {
    pass,
    get message() {
      return `Expected ${pass ? 'not ' : ''}to emit ${args.valueNoun}: ${
          prettyPrint(args.util, args.expectedValue)} but emitted: ${
          prettyPrint(args.util, actualValue)}${
          extraInfo(
              builder.getMessage(),
              actualValue,
              args.expectedValue,
              )}
`;
    }
  };
}

function expectAll<T>(args: {
  actualValues: T[],
  expectedValues: T[],
  valuesNoun: string,
  util: jasmine.MatchersUtil,
  customEqualityTesters: readonly jasmine.CustomEqualityTester[],
}): {pass: boolean, message: string} {
  const builder = jasmine.DiffBuilder();

  const pass = args.util.equals(
      args.actualValues,
      args.expectedValues,
      args.customEqualityTesters,
      builder,
  );

  return {
    pass,
    get message() {
      return `Expected ${pass ? 'not ' : ''}to emit ${args.valuesNoun}: ${
          prettyPrint(args.util, args.expectedValues)} but emitted: ${
          prettyPrint(args.util, args.actualValues)}${
          extraInfo(
              builder.getMessage(),
              args.actualValues,
              args.expectedValues,
              )}`;
    }
  };
}

function prettyPrint(
    util: jasmine.MatchersUtil, val: {}|null|undefined): string {
  return '\n\n' + util.pp(val) + '\n\n';
}
