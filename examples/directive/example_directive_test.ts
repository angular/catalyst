import 'jasmine';

import {Component, Input, ViewChild} from '@angular/core';
import {beforeEach, bootstrap, bootstrapTemplate, describe, expect, flush, getDebugEl, it, setupModule} from '../../index';

import {ExampleDirective} from './example_directive';
import {ExampleModule} from './example_module';

const INITIAL_CONTENT = 'hello';
const INITIAL_CONTENT_UPPERCASE = 'HELLO';

describe('ExampleDirective', () => {
  beforeEach(() => {
    setupModule({
      declarations: [
        ExampleDirective,
        TestComponent,
      ],
      imports: [ExampleModule],
    });
  });

  describe('with bootstrapTemplate', () => {
    let state = {} as {
      fixture: {content: string},
      element: HTMLSpanElement,
      instance: ExampleDirective,
    };

    beforeEach(() => {
      const inputs: Partial<ExampleDirective> = {
        content: INITIAL_CONTENT,
      };

      state.fixture = bootstrapTemplate(
          `<span replaceContent [content]="content">old content</span>`,
          inputs);

      const directiveDebugElement = getDebugEl(ExampleDirective);
      state.element = directiveDebugElement.nativeElement;

      // Without ViewChild (shown in the bootstrap example), this is how
      // we get access to the directive instance.
      // tslint:disable-next-line:deprecation http://yaqs/4612965766266880
      state.instance = directiveDebugElement.injector.get(ExampleDirective);
    });

    afterEach(() => {
      state = {} as unknown as typeof state;
    });

    describe('initial values', () => {
      it(`text content is ${INITIAL_CONTENT}`, () => {
        expect(state.element.textContent).toEqual(INITIAL_CONTENT);
      });

      it(`contentCapitalized property is  ${INITIAL_CONTENT_UPPERCASE}`, () => {
        expect(state.instance.contentCapitalized)
            .toEqual(INITIAL_CONTENT_UPPERCASE);
      });
    });

    describe('when input property is updated', () => {
      const newContent = 'goodbye';

      beforeEach(() => {
        state.fixture.content = newContent;
      });

      it('before flush, text content remains at initial value', () => {
        expect(state.element.textContent).not.toEqual(newContent);
      });

      it('after flush, text content is updated', () => {
        flush();
        expect(state.element.textContent).toEqual(newContent);
      });
    });
  });

  describe('with bootstrap & host component', () => {
    let state = {} as {
      hostComponent: TestComponent,
      element: HTMLSpanElement,
      directiveInstance: ExampleDirective,
    };

    beforeEach(() => {
      const inputs: Partial<TestComponent> = {
        text: INITIAL_CONTENT,
      };

      state.hostComponent = bootstrap(TestComponent, inputs);
      state.directiveInstance = state.hostComponent.directive;
      state.element = getDebugEl(ExampleDirective).nativeElement;
    });

    afterEach(() => {
      state = {} as unknown as typeof state;
    });

    it(`contentCapitalized property is ${INITIAL_CONTENT_UPPERCASE}`, () => {
      expect(state.directiveInstance.contentCapitalized)
          .toBe(INITIAL_CONTENT_UPPERCASE);
    });

    describe('when input property is updated', () => {
      const newContent = 'goodbye';

      beforeEach(() => {
        state.hostComponent.text = newContent;
      });

      it('before flush, text content remains at initial value', () => {
        expect(state.element.textContent).not.toEqual(newContent);
      });

      it('after flush, text content is updated', () => {
        flush();
        expect(state.element.textContent).toEqual(newContent);
      });
    });
  });
});

@Component({
  selector: 'test-component',
  template: `<span replaceContent [content]="text">old content</span>`,
})
class TestComponent {
  // ViewChild is a convenient way to access the directive instance.
  @ViewChild(ExampleDirective, {static: false}) directive!: ExampleDirective;
  @Input() text = '';
}
