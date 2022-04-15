import {asyncMatchers, beforeEach, describe, expect, it, TEST_ONLY} from '../index';
import {BehaviorSubject, NEVER, Observable, of, ReplaySubject, Subject, throwError} from 'rxjs';
import {delay, switchMap} from 'rxjs/operators';

interface MyComparable {
  id: number;
  name: string;
}

describe('AsyncMatchers', () => {
  beforeEach(() => {
    jasmine.addMatchers(asyncMatchers);
  });

  it('should emit value', () => {
    expect(of(1)).toEmit(1);
    expect(of(1).pipe(delay(0))).toEmit(1);
    expect(of(1).pipe(delay(1000))).toEmit(1);
    expect(of('12')).toEmit('12');
    expect(of(undefined)).toEmit(undefined);
    expect(of(null)).toEmit(null);
    expect(of({name: 'name1'})).toEmit({name: 'name1'});

    expect(of(null)).not.toEmit(undefined);
    expect(of(undefined)).not.toEmit(null);
    expect(of(1)).not.toEmit(2);
    expect(of(1)).not.toEmit('1');
    expect(of('1')).not.toEmit(1);
    expect(of({name: 'name1'})).not.toEmit({name: 'name2'});
    expect(of(1, 2)).not.toEmit(1);
    expect(of(1, 2)).not.toEmit(2);

    const behaviorSubject = new BehaviorSubject(1);
    behaviorSubject.next(2);
    expect(behaviorSubject).not.toEmit(1);
    expect(behaviorSubject).toEmit(2);

    expect(new Observable(observer => {
      observer.next(1);
    })).toEmit(1);
    expect(new Observable(observer => {
      observer.next(1);
      observer.next(2);
    })).not.toEmit(1);
    expect(new Observable(observer => {
      observer.next(1);
      observer.next(2);
    })).not.toEmit(2);

    expect(() => {
      expect(new Observable(observer => {
        observer.next(1);
        observer.error(2);
      })).toEmit(2);
    }).toThrow();
  });

  it('should emit value immediately', () => {
    expect(of(1)).toEmitImmediately(1);
    expect(of(1).pipe(delay(0))).not.toEmitImmediately(1);
    expect(of(1).pipe(delay(1000))).not.toEmitImmediately(1);
    expect(of('12')).toEmitImmediately('12');
    expect(of(undefined)).toEmitImmediately(undefined);
    expect(of(null)).toEmitImmediately(null);
    expect(of({name: 'name1'})).toEmitImmediately({name: 'name1'});

    expect(of(null)).not.toEmitImmediately(undefined);
    expect(of(undefined)).not.toEmitImmediately(null);
    expect(of(1)).not.toEmitImmediately(2);
    expect(of(1)).not.toEmitImmediately('1');
    expect(of('1')).not.toEmitImmediately(1);
    expect(of({name: 'name1'})).not.toEmitImmediately({name: 'name2'});
    expect(of(1, 2)).not.toEmitImmediately(1);
    expect(of(1, 2)).not.toEmitImmediately(2);

    const behaviorSubject = new BehaviorSubject(1);
    behaviorSubject.next(2);
    expect(behaviorSubject).not.toEmitImmediately(1);
    expect(behaviorSubject).toEmitImmediately(2);

    expect(new Observable(observer => {
      observer.next(1);
    })).toEmitImmediately(1);
    expect(new Observable(observer => {
      observer.next(1);
      observer.next(2);
    })).not.toEmitImmediately(1);
    expect(new Observable(observer => {
      observer.next(1);
      observer.next(2);
    })).not.toEmitImmediately(2);
    expect(() => {
      expect(new Observable(observer => {
        observer.error(2);
      })).not.toEmitImmediately(2);
    }).toThrow();
  });

  it('should not emit any values', () => {
    expect(NEVER).toHaveNeverEmitted();

    expect(of(null)).not.toHaveNeverEmitted();
    expect(of(undefined)).not.toHaveNeverEmitted();
    expect(of(1)).not.toHaveNeverEmitted();
    expect(of({name: 'name1'})).not.toHaveNeverEmitted();
    expect(of(1, 2)).not.toHaveNeverEmitted();

    const replaySubject = new ReplaySubject();
    expect(replaySubject).toHaveNeverEmitted();
    replaySubject.next(1);
    expect(replaySubject).not.toHaveNeverEmitted();

    expect(new Observable(observer => {})).toHaveNeverEmitted();
    expect(new Observable(observer => {
      observer.next(1);
    })).not.toHaveNeverEmitted();

    expect(() => {
      expect(new Observable(observer => {
        observer.error(1);
      })).toHaveNeverEmitted();
    }).toThrow();
  });

  it('should emit any values', () => {
    expect(NEVER).not.toHaveEmitted();

    expect(of(null)).toHaveEmitted();
    expect(of(undefined)).toHaveEmitted();
    expect(of(1)).toHaveEmitted();
    expect(of({name: 'name1'})).toHaveEmitted();
    expect(of(1, 2)).toHaveEmitted();

    const replaySubject = new ReplaySubject();
    expect(replaySubject).not.toHaveEmitted();
    replaySubject.next(1);
    expect(replaySubject).toHaveEmitted();

    expect(new Observable(observer => {})).not.toHaveEmitted();
    expect(new Observable(observer => {
      observer.next(1);
    })).toHaveEmitted();

    expect(() => {
      expect(new Observable(observer => {
        observer.error(1);
      })).not.toHaveEmitted();
    }).toThrow();
  });

  it('should emit error', () => {
    expect(throwError(1)).toEmitError(1);
    expect(of({}).pipe(delay(1000), switchMap(() => throwError(1))))
        .toEmitError(1);
    expect(throwError('12')).toEmitError('12');
    expect(throwError(undefined)).toEmitError(undefined);
    expect(throwError(null)).toEmitError(null);
    expect(throwError({name: 'name1'})).toEmitError({name: 'name1'});

    expect(throwError(null)).not.toEmitError(undefined);
    expect(throwError(undefined)).not.toEmitError(null);
    expect(throwError(1)).not.toEmitError(2);
    expect(throwError(1)).not.toEmitError('1');
    expect(throwError('1')).not.toEmitError(1);
    expect(throwError({name: 'name1'})).not.toEmitError({name: 'name2'});

    expect(new Observable(observer => {
      observer.error(1);
    })).toEmitError(1);
    expect(new Observable(observer => {
      observer.error(1);
      observer.error(2);
    })).toEmitError(1);
    expect(new Observable(observer => {
      observer.error(1);
      observer.error(2);
    })).not.toEmitError(2);
    expect(new Observable(observer => {
      observer.next(1);
      observer.error(2);
    })).toEmitError(2);
  });

  it('should emit error immediately', () => {
    expect(throwError(1)).toEmitErrorImmediately(1);
    expect(of({}).pipe(delay(0), switchMap(() => throwError(1))))
        .not.toEmitErrorImmediately(1);
    expect(of({}).pipe(delay(1000), switchMap(() => throwError(1))))
        .not.toEmitErrorImmediately(1);
    expect(throwError('12')).toEmitErrorImmediately('12');
    expect(throwError(undefined)).toEmitErrorImmediately(undefined);
    expect(throwError(null)).toEmitErrorImmediately(null);
    expect(throwError({name: 'name1'})).toEmitErrorImmediately({name: 'name1'});

    expect(throwError(null)).not.toEmitErrorImmediately(undefined);
    expect(throwError(undefined)).not.toEmitErrorImmediately(null);
    expect(throwError(1)).not.toEmitErrorImmediately(2);
    expect(throwError(1)).not.toEmitErrorImmediately('1');
    expect(throwError('1')).not.toEmitErrorImmediately(1);
    expect(throwError({name: 'name1'})).not.toEmitErrorImmediately({
      name: 'name2'
    });

    expect(new Observable(observer => {
      observer.error(1);
    })).toEmitErrorImmediately(1);
    expect(new Observable(observer => {
      observer.error(1);
      observer.error(2);
    })).toEmitErrorImmediately(1);
    expect(new Observable(observer => {
      observer.error(1);
      observer.error(2);
    })).not.toEmitErrorImmediately(2);
    expect(new Observable(observer => {
      observer.next(1);
      observer.error(2);
    })).toEmitErrorImmediately(2);
  });

  it('should emit sequence', () => {
    expect(of(1, 2, 3)).toEmitSequence([1, 2, 3]);
    expect(of(1, 2, 3).pipe(delay(2000))).toEmitSequence([1, 2, 3]);
    expect(of()).toEmitSequence([]);

    expect(of(1, 2, 3)).not.toEmitSequence([1, 2, '3']);
    expect(of(1, 2)).not.toEmitSequence([1, 2, 3]);
    expect(of(1, 2, 3, 4)).not.toEmitSequence([1, 2, 3]);

    expect(new Observable(() => {})).toEmitSequence([]);
    expect(new Observable(observer => {
      observer.next(1);
      observer.next(2);
    })).toEmitSequence([1, 2]);
    expect(() => {
      expect(new Observable(observer => {
        observer.next(1);
        observer.next(2);
        observer.error(3);
      })).toEmitSequence([1, 2]);
    }).toThrow();
  });

  it('should emit sequence immediately', () => {
    expect(of(1, 2, 3)).toEmitSequenceImmediately([1, 2, 3]);
    expect(of(1, 2, 3).pipe(delay(0))).toEmitSequenceImmediately([]);
    expect(of(1, 2, 3).pipe(delay(0))).not.toEmitSequenceImmediately([1, 2, 3]);
    expect(of(1, 2, 3).pipe(delay(2000))).toEmitSequenceImmediately([]);
    expect(of(1, 2, 3).pipe(delay(2000))).not.toEmitSequenceImmediately([
      1, 2, 3
    ]);
    expect(of()).toEmitSequenceImmediately([]);

    expect(of(1, 2, 3)).not.toEmitSequenceImmediately([1, 2, '3']);
    expect(of(1, 2)).not.toEmitSequenceImmediately([1, 2, 3]);
    expect(of(1, 2, 3, 4)).not.toEmitSequenceImmediately([1, 2, 3]);

    expect(new Observable(() => {})).toEmitSequenceImmediately([]);
    expect(new Observable(observer => {
      observer.next(1);
      observer.next(2);
    })).toEmitSequenceImmediately([1, 2]);
    expect(() => {
      expect(new Observable(observer => {
        observer.error(3);
      })).not.toEmitSequenceImmediately([1, 2]);
    }).toThrow();
  });

  it('should resolve with', () => {
    expect(Promise.resolve({
      name: 'obj1',
    })).toResolveWith({
      name: 'obj1',
    });

    expect(Promise.resolve({
      name: 'obj1',
    })).not.toResolveWith({
      name: 'obj2',
    });
    expect(Promise.reject(1)).not.toResolveWith(1);
  });

  it('should reject with', () => {
    expect(Promise.reject({
      name: 'obj1',
    })).toRejectWith({
      name: 'obj1',
    });

    expect(Promise.reject({
      name: 'obj1',
    })).not.toRejectWith({
      name: 'obj2',
    });
    expect(Promise.resolve(1)).not.toRejectWith(1);
  });

  it('should reject with error', () => {
    const p = Promise.reject(new Error('some error'));
    expect(p).toRejectWithError('some error');
    expect(p).toRejectWithError(/some error/);
    expect(p).toRejectWithError(/.*error/);
    expect(p).not.toRejectWithError(/all good/);
  });

  it('should not reject with error', () => {
    expect(Promise.resolve({name: 'obj1'})).not.toRejectWithError(/error/);
    expect(Promise.reject({name: 'obj1'})).not.toRejectWithError(/error/);
  });

  it('should be pending', () => {
    expect(new Promise(() => {})).toBePending();
  });

  it('should not be pending', () => {
    expect(Promise.resolve({name: 'obj1'})).not.toBePending();
    expect(Promise.reject({name: 'obj1'})).not.toBePending();
  });

  it('should support empty emitters', () => {
    const subject: Subject<void> = new ReplaySubject<void>();
    subject.next();

    expect(subject).toEmit(undefined);
    expect(subject).toEmitSequence([undefined]);
    subject.complete();
  });

  it('should support custom equality testers', () => {
    const obj1: MyComparable = {
      id: 1,
      name: 'name1',
    };
    const obj2: MyComparable = {
      id: 2,
      name: 'name1',
    };
    const obj1Clone = {
      id: 1,
      name: 'name2',
    };

    const objCustomEquality = (first: MyComparable, second: MyComparable) => {
      return !!first.id && !!second.id && first.id === second.id;
    };
    jasmine.addCustomEqualityTester(objCustomEquality);

    const subject = new ReplaySubject<MyComparable>();
    subject.next(obj1);

    expect(subject).not.toEmit(obj2);
    expect(subject).toEmit(obj1Clone);

    expect(Promise.resolve(obj1)).not.toResolveWith(obj2);
    expect(Promise.resolve(obj1)).toResolveWith(obj1Clone);

    expect(Promise.reject(obj1)).not.toRejectWith(obj2);
    expect(Promise.reject(obj1)).toRejectWith(obj1Clone);
  });
});

describe('AsyncMatcher Factories', () => {
  const NATIVE_EQ_TESTER: jasmine.CustomEqualityTester =
      (first: {}, second: {}): boolean => {
        console.log(`Comparing ${first} with ${second}`);
        return first === second;
      };

  describe('biffBuilder', () => {
    function getComparator(name: string) {
      return TEST_ONLY.asyncMatchersRaw[name](jasmine.matchersUtil, []).compare;
    }

    it('is used by onEmit', () => {
      const comparator = getComparator('toEmit');

      const result = comparator(of([1, 2, 3]), [1, 2]);

      expect(result.message).toContain('Expected $.length = 3 to equal 2');
      expect(result.message).toContain('Unexpected $[2] = 3 in array.');
    });

    it('only works for arrays and objects', () => {
      const comparator = getComparator('toEmit');

      expect(comparator(of(1), 2).message)
          .not.toContain('Expected 1 to equal 2.');
      expect(comparator(of('a'), 'b').message)
          .not.toContain('Expected a to equal b.');
      expect(comparator(of([1]), {a: 1}).message)
          .not.toContain('Expected [ 1 ] to equal Object({ a: 1 })');
    });

    it('is used by toResolveWith', () => {
      const comparator = getComparator('toResolveWith');

      const result = comparator(Promise.resolve([1, 2, 3]), [1, 2]);

      expect(result.message).toContain('Expected $.length = 3 to equal 2');
      expect(result.message).toContain('Unexpected $[2] = 3 in array.');
    });

    it('is used by toRejectWith', () => {
      const comparator = getComparator('toRejectWith');

      const result = comparator(Promise.reject([1, 2, 3]), [1, 2]);

      expect(result.message).toContain('Expected $.length = 3 to equal 2');
      expect(result.message).toContain('Unexpected $[2] = 3 in array.');
    });

    it('is used by toEmitSequence', () => {
      const comparator = getComparator('toEmitSequence');

      const result = comparator(of([1], [2], [3]), [[1, 2], [5, 6, 7]]);

      expect(result.message).toContain('Expected $.length = 3 to equal 2');
      expect(result.message).toContain('Expected $[0].length = 1 to equal 2');
      expect(result.message)
          .toContain('Expected $[0][1] = undefined to equal 2');
      expect(result.message).toContain('Expected $[1].length = 1 to equal 3');
      expect(result.message).toContain('Expected $[1][0] = 2 to equal 5');
      expect(result.message)
          .toContain('Expected $[1][1] = undefined to equal 6');
      expect(result.message)
          .toContain('Expected $[1][2] = undefined to equal 7');
    });
  });

  describe('toEmit', () => {
    let toEmitCompare: <T>(actual: Observable<T>, expected: T) =>
        jasmine.CustomMatcherResult;

    beforeEach(() => {
      toEmitCompare = TEST_ONLY
                          .asyncMatchersRaw['toEmit'](
                              jasmine.matchersUtil, [NATIVE_EQ_TESTER])
                          .compare;
    });

    it('fails when comparing with unexpected object', () => {
      const o = of(1);
      const expected = 2;

      const result = toEmitCompare(o, expected);
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(/Expected to emit value:\s*2\s*but emitted:\s*1/);
    });
  });

  describe('toResolveWith', () => {
    let toResolveWithCompare: <T>(actual: Promise<T>, expected: T) =>
        jasmine.CustomMatcherResult;

    beforeEach(() => {
      toResolveWithCompare = TEST_ONLY
                                 .asyncMatchersRaw['toResolveWith'](
                                     jasmine.matchersUtil, [NATIVE_EQ_TESTER])
                                 .compare;
    });

    it('passes when resolution is with expected object', () => {
      const p = Promise.resolve('some resolution');

      const result = toResolveWithCompare(p, 'some resolution');
      expect(result).toBeDefined();
      expect(result.pass).toBe(true);
      expect(result.message).toMatch(/^Expected not to resolve with:.*/);
    });

    it('fails when resolution is with unexpected object', () => {
      const p = Promise.resolve('some unexpected resolution');

      const result = toResolveWithCompare(p, 'some resolution');
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(/^Expected to resolve with:(.|\n)*but resolved with:/);
    });

    it('fails when promise rejects', () => {
      const p = Promise.reject('it rejected to this string');

      const result = toResolveWithCompare(p, 'some resolution');
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(/^Expected promise to resolve, but it rejected with:.*/);
    });

    it('fails when promise is still pending', () => {
      const p = new Promise(() => {});

      const result = toResolveWithCompare(p, 'some resolution');
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toEqual('Expected promise to resolve, but it is still pending.');
    });
  });

  describe('toRejectWith', () => {
    let toRejectWithCompare:
        <T>(actual: Promise<T>, expected: {}|null|undefined) =>
            jasmine.CustomMatcherResult;

    beforeEach(() => {
      toRejectWithCompare = TEST_ONLY
                                .asyncMatchersRaw['toRejectWith'](
                                    jasmine.matchersUtil, [NATIVE_EQ_TESTER])
                                .compare;
    });

    it('passes when rejection is with expected object', () => {
      const p = Promise.reject('some rejection');

      const result = toRejectWithCompare(p, 'some rejection');
      expect(result).toBeDefined();
      expect(result.pass).toBe(true);
      expect(result.message).toMatch(/^Expected not to reject with:.*/);
    });

    it('fails when rejection is with unexpected object', () => {
      const p = Promise.reject('some unexpected rejection');

      const result = toRejectWithCompare(p, 'some rejection');
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(/^Expected to reject with:(.|\n)*but rejected with:/);
    });

    it('fails when promise resolves', () => {
      const p = Promise.resolve('it resolved to this string');

      const result = toRejectWithCompare(p, 'some rejection');
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(/^Expected promise to reject, but it resolved with:.*/);
    });

    it('fails when promise is still pending', () => {
      const p = new Promise(() => {});

      const result = toRejectWithCompare(p, 'some rejection');
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toEqual('Expected promise to reject, but it is still pending.');
    });
  });

  describe('toRejectWithError', () => {
    let toRejectWithErrorCompare:
        <T>(actual: Promise<T>, expectedMessage?: string|RegExp|undefined) =>
            jasmine.CustomMatcherResult;

    beforeEach(() => {
      toRejectWithErrorCompare =
          TEST_ONLY
              .asyncMatchersRaw['toRejectWithError'](
                  jasmine.matchersUtil, [NATIVE_EQ_TESTER])
              .compare;
    });

    it('passes when rejection is Error with expected error message RegExp',
       () => {
         const p = Promise.reject(new Error('some error'));

         const result = toRejectWithErrorCompare(p, /.*error/);
         expect(result).toBeDefined();
         expect(result.pass).toBe(true);
         expect(result.message)
             .toMatch(new RegExp(
                 '^Expected not to reject with an Error that has the message ' +
                 'that matches the RegExp:.*'));
       });

    it('failes when rejection is Error with unexpected error message RegExp',
       () => {
         const p = Promise.reject(new Error('some error'));

         const result = toRejectWithErrorCompare(p, /something else/);
         expect(result).toBeDefined();
         expect(result.pass).toBe(false);
         expect(result.message)
             .toMatch(new RegExp(
                 '^Expected to reject with an Error that has the message ' +
                 'that matches the RegExp:.*'));
       });

    it('passes when rejection is Error with expected error message string',
       () => {
         const p = Promise.reject(new Error('some error'));

         const result = toRejectWithErrorCompare(p, 'some error');
         expect(result).toBeDefined();
         expect(result.pass).toBe(true);
         expect(result.message)
             .toMatch(new RegExp(
                 '^Expected not to reject with an Error ' +
                 'that has the message:*'));
       });

    it('fails when rejection is Error with unexpected error message string',
       () => {
         const p = Promise.reject(new Error('some error'));

         const result = toRejectWithErrorCompare(p, 'something else');
         expect(result).toBeDefined();
         expect(result.pass).toBe(false);
         expect(result.message)
             .toMatch(
                 /^Expected to reject with an Error that has the message:*/);
       });

    it('passes when rejection is Error with no expected error message', () => {
      const p = Promise.reject(new Error('some error'));

      const result = toRejectWithErrorCompare(p);
      expect(result).toBeDefined();
      expect(result.pass).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('fails when rejection is not an Error', () => {
      const p = Promise.reject('this is not an Error object');

      const result = toRejectWithErrorCompare(p);
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(
              /^Expected promise to reject with an Error but rejected with:.*/);
    });
    it('fails when promise resolves', () => {
      const p = Promise.resolve('it resolved to this string');

      const result = toRejectWithErrorCompare(p);
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toMatch(/^Expected promise to reject, but it resolved with:.*/);
    });

    it('fails when promise is still pending', () => {
      const p = new Promise(() => {});

      const result = toRejectWithErrorCompare(p);
      expect(result).toBeDefined();
      expect(result.pass).toBe(false);
      expect(result.message)
          .toEqual('Expected promise to reject, but it is still pending.');
    });
  });
});
