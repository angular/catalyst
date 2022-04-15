# Writing a catalyst test

## The example component under test

We will be working with a simple component.

### The template

See [example_component.ng.html](../example_component.ng.html)

### The component class

See [exmaple_component.ts](../example_component.ng.html)

## Step 1: Set up the test module

The first step is to set up the testing module for the component under test. You
call the setupModule function and provide module metadata that will be used to
create the test module. Ideally you will import the module that the component
you are testing belongs to and configure spies for providers. In this example we
will start small:

```typescript
import {beforeEach, describe, expect, setupModule} from '@angular/catalyst';

import {INJECTED_MESSAGE} from './example_component';
import {ExampleComponent} from './example_component';
import {ExampleModule} from './example_module';

describe('ExampleComponent', () => {
  const EXAMPLE_INJECTED_MESSAGE = 'I always get the shemp';

  beforeEach(() => {
    setupModule({
      // Import the modules you need, usually this will be the module the
      // component you are testing belongs to. You may also have testing modules
      // like RouterTestingModule here.
      imports: [ExampleModule],
      // We provide the value for the INJECTED_MESSAGE token because it isn't
      // tree-shakeable or provided directly in ExampleModule.
      providers:
          [{provide: INJECTED_MESSAGE, useValue: EXAMPLE_INJECTED_MESSAGE}],
      // Ensure that all fixtures have been removed between tests.
      teardown: {destroyAfterEach: true},
    });
  });
});
```

The argument to setupModule is a `ModuleConfig` from
([helpers.ts](../../helpers.ts)).

This is a similar to creating a new `NgModule` as this config will be used to
create an `NgModule` for testing. There some important distictions:

*   The providers specified with `providers` will be used only if the provider
    is not part of the modules you import. The providers in `superProviders`
    will be used even if such a provider is part of the modules you import or
    one of its components.
*   `ng1Modules` and `ng1Scope` are used for AngularJs components.
*   `schemas` is used to determine custom schemas for tags that are not part of
    the standard DOM or an Angular component.

## Step 2: Bootstrap the component

At the moment we only have a module which will allow for dependency injection
but we have not rendered anything into the DOM yet. To create the DOM for the
test we need to bootstrap. There are two ways in Catalyst to bootstrap.

NOTE: `bootstrap` or `bootstrapTemplate` may only be called once per test.

### `bootstrap`

Using this method, the component becomes the root element of the test. Calling
`getDebugEl` with no arguments will return the `TypedDebugElement` for the
component and `getEl` with no arguments will return the `HTMLElement` of the
component. The second argument to the `bootstrap` call is an object of type
`Partial<T>`, where `T` is your component. You can use this to override the
inputs to the component.

IMPORTANT: If your component uses `@Input`-s you should use `bootstrapTemplate`.
See http://b/76024815. If you use `bootstrap` for such components, your tests
won't mimic Angular behavior with respect to `ngOnChange`s running before
`ngOnInit`. This is also discussed in http://yaqs/6383947307810816.

### `bootstrapTemplate`

`bootstrapTemplate` works similar to `bootstrap` but instead of providing the
component instance, you provide a template that makes use of the component to
test. This template becomes the root of the test. This is most useful when
testing interactions between a component and its parent because you can easily
specify how the template is used in the DOM. The second argument to
`bootstrapTemplate` is an object that can be accessed in the template (this is
not an override of the component you are testing).

NOTE: The second argument here is not of type `Partial<T>`, though it may appear
that way in some cases. For example if bootstrapTemplate uses a component
(`baz-component`) that has a string input `foo`, and the template used is
`<baz-component [foo]="bar"></baz-component>` then the second argument would be
of type `{bar:string}`. On the other hand, if you named your bindings to match
those used by `baz-component`, then using `Partial<BazComponent>`, such as if
you used `<baz-component [foo]="foo"></baz-component>`.

Typically we will need to change the values of this object's inputs (e.g. to
simulate the parent component passing a different set of inputs). One way to do
this is by getting the component instance, named `fixtureComponent` and the
setting its properties. While common, this does not exactly simulate an input
changing, and could be thought of like accessing the component instance's
private API.

```typescript
const fixtureComponent = bootstrapTemplate(
    `<example-component [aProperty]="aProperty"></example-component>`, {
      aProperty: 'initialValue',
    });

fixtureComponent.aProperty = 'newValue';
flush();
```

Using a getter better simulates how the input would be changed in the actual
Angular app, as follows:

```typescript
let aProperty = 'initialValue';

bootstrapTemplate(
    `<example-component [aProperty]="aProperty"></example-component>`, {
      get aProperty() {
        return aProperty;
      },
});

aProperty = 'newValue';
flush();
```

In the below example we use `bootstrapTemplate` because `ExampleComponent` has
an `@Output` property we want to test.

NOTE: Generally, use `bootstrapTemplate` when working with a component that has
inputs and outputs you want to test.

```typescript
import 'jasmine';

import {beforeEach, bootstrapTemplate, describe, expect, it, setupModule} from '@angular/catalyst';
import {ReplaySubject} from 'rxjs';

import {AN_OBSERVABLE, ExampleComponent, INJECTED_MESSAGE} from './example_component';
import {ExampleModule} from './example_module';

describe('ExampleComponent', () => {
  const EXAMPLE_INJECTED_MESSAGE = 'I always get the shemp';

  let outputSpy: jasmine.Spy;
  let subject: ReplaySubject<string>;

  beforeEach(() => {
    outputSpy = jasmine.createSpy('outputSpy');
    subject = new ReplaySubject(1);

    setupModule({
      imports: [ExampleModule],
      providers: [
        {provide: INJECTED_MESSAGE, useValue: EXAMPLE_INJECTED_MESSAGE},
        {provide: AN_OBSERVABLE, useValue: subject},
      ],
    });

    bootstrapTemplate(
        `<example-component
            (anOutput)="outputSpy($event)">
        </example-component>`,
        {outputSpy},
    );
  });
});
```

## Step 3: Assert DOM state

Catalyst provides helper functions for asserting the state of the DOM as a
result of the behavior of your component and makes managing the test easy by
removing fixture management. In this test we can assert the state of the DOM and
manage change detection easily, without referencing the fixture directly (which
is returned by `bootstrapTemplate`, but in this case not assigned to a
variable). See [`example_component_test.ts`](../example_component_test.ts)
