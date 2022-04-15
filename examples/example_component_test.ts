import 'jasmine';

import {beforeEach, bootstrapTemplate, describe, expect, flush, getDebugEl, getEl, it, setupModule} from '../index';
import {ReplaySubject} from 'rxjs';

import {AN_OBSERVABLE, ExampleComponent, INJECTED_MESSAGE} from './example_component';
import {ExampleModule} from './example_module';

describe('ExampleComponent', () => {
  const EXAMPLE_INJECTED_MESSAGE = 'I always get the shemp';

  let anInput = 'Hello world!';
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
            [anInput]="anInput"
            (anOutput)="outputSpy($event)">
        </example-component>`,
        {
          get anInput() {
            return anInput;
          },
          outputSpy,
        },
    );
  });

  it('shows the input message', () => {
    // The default value for the input.
    expect(getEl('.from-an-input').textContent).toContain('Hello world!');

    // We can change the input and change the DOM. Note: Catalyst uses a
    // TypedDebugElement so the componentInstance has the correct type instead
    // of 'any'.
    getDebugEl(ExampleComponent).componentInstance.anInput =
        'A different value';

    // Flush all pending changes.
    flush();

    expect(getEl('.from-an-input').textContent).toContain('A different value');
  });

  it('shows the input message', () => {
    // The default value for the input.
    expect(getEl('.from-computed-value').textContent)
        .toContain('::Hello world!::');

    // We can also change the input (and thus the DOM) by modifying this
    // value that is bound to the template. It will trigger lifecycle methods
    // like `ngOnChanges`. Changing the `componentInstance` variable directly
    // will not trigger such lifecycle methods.
    anInput = 'A different value';

    // Flush all pending changes.
    flush();

    expect(getEl('.from-computed-value').textContent)
        .toContain('::A different value::');
  });

  it('shows the injected message', () => {
    expect(getEl('.from-injection').textContent)
        .toContain(EXAMPLE_INJECTED_MESSAGE);
  });

  it('shows the async message', () => {
    subject.next('An async message');
    flush();

    expect(getEl('.from-async').textContent).toContain('An async message');

    subject.next('Another async message');
    flush();

    expect(getEl('.from-async').textContent).toContain('Another async message');
  });

  it('handles output events', () => {
    expect(outputSpy).not.toHaveBeenCalled();

    // Cause the component to emit an 'anOutput' event to the parent component.
    getDebugEl(ExampleComponent).triggerEventHandler('anOutput', false);

    expect(outputSpy).toHaveBeenCalledTimes(1);
    expect(outputSpy).toHaveBeenCalledWith(false);

    getDebugEl(ExampleComponent).triggerEventHandler('anOutput', true);

    expect(outputSpy).toHaveBeenCalledTimes(2);
    expect(outputSpy).toHaveBeenCalledWith(true);
  });
});
