# Catalyst

Catalyst was an experimental opinionated wrapper around the Angular testing API
with the aim of reducing number of decisions and boilerplate while writing
tests.

**This is an experimental API and is not an officially supported product of
Google or Angular. Do not use.**

This was only an experiment which the Angular team ultimately decided not to
move forward with. The code is published here for historical purposes, though it
lacks some of the infrastructure it relied on to function internally and doesn't
work out of the box in this context.

Three challenges to address to get this to work:
1.  Catalyst relies on `@angular/http` which has been replaced by
    `@angular/common/http`. Existing `@angular/http` usage would need to be
    migrated.
1.  Catalyst used
    [`goog.module()`](https://google.github.io/closure-library/api/goog.module.html)
    internally, but Jasmine doesn't support that normally meaning we need to use
    CommonJS or ESM. Angular v13+ only supports ESM, but this version of Jasmine
    appears to be too old to use ESM and will likely need to be upgraded.
1.  Catalyst itself doesn't really require the Angular compiler to be built, but
    the components it tests do need to be AOT compiled with the Angular CLI or
    `@angular/compiler-cli`. For real Angular code, this is probably already the
    case, but this repository does not run the Angular compiler and tests in
    here likely won't work as is.

Catalyst tests are synchronous (when not using `it.async`) and asserted to be
so. Catalyst uses a fakeAsync Zone to capture all async tasks within Angular and
resolve them synchronously. This makes the test easier to write, read and debug.

It also automatically runs change detection synchronously whenever an event
handler is fired. This reduces boilerplate around having to manually trigger
change detection in tests.

If you are using Catalyst, your tests should not use any imports from
`@angular/core/testing`

## API

-   `describe`, `it`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`
    -   Catalyst wrappers to Jasmine that asserts everything is synchronous
-   `describe.only`, `it.only`
    -   Convenience shorthand for `fdescribe` and `fit`, respectively
-   `describe.skip`, `it.skip`
    -   Convenience shorthand for `xdescribe` and `xit`, respectively
-   `setupModule`
    -   To setup the testing module
-   `bootstrap`, `bootstrapTemplate`
    -   To synchronously bootstrap from a Component or from a dynamic template
        string (No more async compileComponents())
-   `getEl`, `getEls`, `hasEl`
    -   Locate HTML element(s) using querySelector/querySelectorAll in the DOM
-   `getDebugEl`, `getDebugEls`, `hasDebugEl`
    -   Locate DebugElement by Directive or Component type
-   `tick`
    -   Advance timer queue by the specified amount and reflect any pending
        state change to DOM
-   `describeWithDate`
    -   Mocks `Date.now()`, `jasmine.clock()` and `goog.now` inside of describe
        block. `tick` will also move time as seen by all of the above methods.
        Only works when used instead of the top level `describe` in the file
        (b/150296894).
-   `flush`, `markForCheckAndFlush`
    -   Flush all pending non-periodic timers and promises and reflects any
        pending state change to DOM
    -   `markForCheckAndFlush` performs `flush` for components with OnPush
        change detection strategy. This is only necessary when modifying
        properties directly on OnPush components within your test.
        Alternatively, you may consider using bootstrapTemplate(), updating the
        context, and/or calling flush().
-   `get`
    -   Inject an object by token
-   `trigger`
    -   Trigger an event on a HTMLElement
-   `now`
    -   Run async tasks synchronously and reflects any pending state change to
        the DOM.
-   `destroyTestComponent`
    -   Destroys the root test component and all of its children. This will
        `ngOnDestroy` to be called in all components.

## Managing State Change

Any DOM events triggered in the test automatically resolve all pending promises
and run Angular change detection synchronously.

So if you did something like

```typescript
getEl('p').click();
// DOM updated with state change caused by the click handler even if it's async
```

In your test you no longer have to call the right combination of whenStable,
detectChanges. It gets done for you automatically and synchronously (using Zone
interception of event handler invocation).

If you don't trigger a state change through an event handler, you can manually
force a change detection using `flush`. `flush` recursively flushes all pending
async tasks(scheduled by Promise-s and setTimeout-s) and then runs change
detection at the end. In that way it flushes all pending tasks and state changes
and the test is at a stable state at the end of it.

```typescript
componentInstance.myProperty = 10;
flush();
// DOM updated with myProperty in component set to 10.
```

Catalyst doesn't allow any async tasks to be scheduled directly in the test. To
run an async task you can wrap it with `now()` to run the task synchronously.
Any changes to the component state is automatically reflected in the DOM.

```typescript
now(() => componentInstance.asyncTask());

// At this point asyncTask has been run synchronously and any state change will
// be reflected in DOM.
```

When changing element values, a `trigger` is required to update any ngForm
component values and validity:

```typescript
const input = getEl<HTMLInputElement>('input.template-name-input');
input.value = value;     // HTML is updated, ngForm.value is still not updated
trigger(input, 'input'); // ngForm.value/ngForm.valid is updated
```

## Managing Timer Queue

The event queue can either be moved ahead by a specified time interval using
`tick(INTERVAL)` or all pending timers can be recursively triggered using
`flush()`.

The former is useful for precise control of time in your unit test while the
latter can be used to trigger any pending timers in an external component that
your component under test is using(and you don’t want your test to be tied to
exact timeout values).

When inside `describeWithDate` block, `tick` and `flush` also advance the mock
Date through Jasmine's Date mocking facility. `Date.now()` is properly advanced
as per the elapsed time in the test scheduler of Catalyst. Catalyst
automatically installs and uninstalls the Jasmine mock Date before and after
each test respectively. This is useful for testing code that reschedules tasks
depending on the currently elapsed time.

In addition Catalyst monkey patches the RxJS scheduler to use the Jasmine mock
Date so that the default async scheduler of RxJS is in sync with the test
scheduler of Catalyst. This is needed to make RxJS operators like `delay`,
`debounce` etc. to work as expected with `tick` and `flush`.

## XHR calls / HTTP testing

If the code under test makes any XHR calls you will need to mock the HTTP
backend.

```typescript
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

let mockHttp: HttpTestingController;

beforeEach(() => {
  setupModule({
    imports: [
      AppModule,
      HttpClientTestingModule,
      NoopAnimationsModule,
    ],
  });

  // bootstrap your component ...

  mockHttp = get(HttpTestingController);
});

afterEach(() => {
  mockHttp.verify();
});

it('my test', () => {
  // your test ...
});
```

Note that you won't be able to use `mockHttp` to respond to any HTTP requests
until the code under test has created the HTTP request. If your component does
HTTP logic inside its constructor or `ngOnInit`, you can immediately use
`mockHttp` after `get`, as the constructor and `ngOnInit` immediately run after
you call `bootstrap`/`bootstrapTemplate`. A code example follows for all other
scenarios.

```typescript
import {asyncMatchers} from '@angular/catalyst';
import {lastValueFrom} from 'rxjs';
import {shareReplay} from 'rxjs/operators';

// beforeEach/afterEach from above

beforeEach(() => {
  // another beforeEach to enable toEmit matcher
  jasmine.addMatchers(asyncMatchers);
});

it('service calls http', () => {
  const output = myService.myObservableMethod('param')
      .pipe(shareReplay({bufferSize: 1, refCount: true}));

  // Subscribe to the observable but don't await it. It will now be stuck
  // waiting on an HTTP response. Using `firstValueFrom()` / `lastValueFrom()`
  // here unsubscribes automatically to avoid leaking test state.
  lastValueFrom(output);

  const request = mockHttp.expectOne('endpoint');
  expect(request.request.method).toBe('POST');
  request.flush('http response');

  expect(output).toEmit('http response');
});
```

WARNING: If you find the test doesn't work with `lastValueFrom`, try
`firstValueFrom`. If that also fails, then instead of `lastValueFrom(output)`,
you can use `output.subscribe()` to also trigger the observable, but will then
need to manually call `.unsubscribe()` when you are done with the result.

For more on mocking and testing XHR calls see
https://angular.io/guide/http#testing-http-requests.

## Angular Harnesses

Many Angular Material components provide
[harnesses](https://material.angular.io/cdk/test-harnesses/overview) to ease
testing code that calls them.

## Async Matchers

Catalyst provides jasmine matchers to simplify testing of async code.

```typescript
import {beforeAll, it, asyncMatchers} from '@angular/catalyst';

beforeAll(() => {
  jasmine.addMatchers(asyncMatchers);
});

...
// For Observables:
expect(service.someAsyncCall()).toEmit(expectedResponse);
expect(service.someAsyncCallWithError()).toEmitError(expectedErrorResponse);
expect(service.someAsyncCallWithMultipleResults()).toEmitSequence([response1, response2]);
// Same as above without respect to ordering
expect(service.someAsyncCallWithMultipleResults())
    .toEmitSequence(jasmine.arrayWithExactContents([response2, response1]));
// Only checks partial results
expect(service.someAsyncCallWithManyResults()).toEmitSequence(jasmine.arrayContaining([response1]));
expect(service.someAsyncCallWithNoValue()).toHaveNeverEmitted();
expect(service.someAsyncCallWithNoValue()).toHaveEmitted();

// For Promises:
expect(service.someAsyncCall()).toResolveWith(expectedResponse);
expect(service.someAsyncCall()).toRejectWith(expectedRejectionValue);
expect(service.someAsyncCall()).toRejectWithError(expectedErrorMessageOrRegExp);

```

### Matching hot observables

Catalyst's async matchers essentially subscribe to the observable and collect
all values that are emitted immediately on subscription. They won't work
properly with
["hot" observables](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339)
(including Angular's `EventEmitter`). This is because "hot" observables emit
immediately, not on subscription, so by the time that the async matcher has
subscribed in the `expect().toEmit()` line the emissions have already occurred
and the matcher doesn't see any further emissions.

The fix is to use a `ReplaySubject` - or, more conveniently, an operator like
`shareReplay()` that uses a `ReplaySubject` under the hood - to save the
emissions and then check them later.

```typescript
import {firstValueFrom} from 'rxjs';
import {shareReplay} from 'rxjs/operators';

...
const obs = service.hotObservable.pipe(shareReplay());

// Subscribe to the observable but don't await it. It will now be stuck
// waiting for emissions. Using `firstValueFrom()` / `lastValueFrom()` here
// unsubscribes automatically to avoid leaking test state.
firstValueFrom(obs);

service.doThingThatTriggersEmissions();
expect(obs).toEmit(expectedEmissions);
```

WARNING: If you find the test doesn't work with `firstValueFrom`, try
`lastValueFrom`. If that also fails, then instead of `firstValueFrom(output)`,
you can use `output.subscribe()` to also trigger the observable, but will then
need to manually call `.unsubscribe()` when you are done with the result.

## Necessarily asynchronous tests

In some cases, such as screen diffing tests, the test requires asynchronous
behavior. In this case `it.async(..., async () => { ... })` may be called.
`it.async.skip` and `it.async.only` functions are provided to skip or filter
tests when dealing with `it.async`. When setting up a `beforeEach` with
asynchronicity, use `beforeEach.async`.

## Animations

If the component you are testing uses material components, chances are they use
animatons, and the test needs to disable animations. This is also true if you
use harnesses, or if you receive the following error message.

```
Found the synthetic property @transitionMessages. Please include either "BrowserAnimationsModule" or "NoopAnimationsModule" in your application.
```

The easiest way to fix this is to import `NoopAnimationsModule` in your test. It
must be the last module imported, so it overrides any other transitively
imported modules related to animations.

```typescript
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

beforeEach(() => {
  setupModule({
    imports: [
      AppModule,
      NoopAnimationsModule,
    ],
  });

  // bootstrap your component ...
});

it('my test', () => {
  // ...
});
```
