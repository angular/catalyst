import {AfterViewInit, ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, DebugElement, ElementRef, EventEmitter, Inject, Injectable, InjectionToken, Input, NgModule, NgZone, OnChanges, OnDestroy, OnInit, Output, RendererFactory2, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {afterEach, afterEachLegacy, beforeEach, beforeEachLegacy, bootstrap, bootstrapTemplate, describe, describeWithDate, destroyTestComponent, expect, flush, get, getDebugEl, getDebugEls, getEl, getEls, hasDebugEl, hasEl, it, itLegacy, markForCheckAndFlush, now, setupModule, tick, trigger} from './index';
import {from, Observable, Observer} from 'rxjs';
import {debounceTime, delay} from 'rxjs/operators';

import {AotParentComponent, AotTestComponent, AotTestModule} from './test_component';


declare const global: {};
interface Global {
  it: Function;
  goog?: {now?: () => number};
}
const _global: Global =
    (typeof window === 'undefined' ? global : window) as Global;

describe('catalyst', () => {
  let state = 0;

  beforeAll(() => {
    // beforeAll should be executed without any errors.
    expect(true).toBe(true);
  });

  afterAll(() => {
    // afterAll should be executed without any errors.
    expect(true).toBe(true);
  });

  // Use the unpatched afterEach to make sure the patched one executes.
  // TODO(b/186802882): Remove any after Jasmine upgrade is in. Element
  // implicitly has an 'any' type because expression of type '"afterEach"' can't
  // be used to index type 'Env'.
  (jasmine.getEnv() as any)['afterEach'](() => {
    expect(state).toBe(3);
  });

  beforeEach(() => {
    state = 1;
  });

  it('executes patched test methods', () => {
    expect(state).toBe(1);
    state = 2;
  });

  afterEach(() => {
    expect(state).toBe(2);
    state = 3;
  });
});

describe('catalyst', () => {
  it('expects nothing', () => {
    expect().nothing();
  });
});

describe('catalyst', () => {
  let comp: TestComponent;
  let root: HTMLElement;

  beforeEach(() => {
    setupModule({imports: [TestModule]});
    comp = bootstrap(TestComponent);
    // getEl() is the root app element.
    root = getEl();
  });

  _global.it('APIs throw exceptions outside the catalyst \'it\'', () => {
    expect(() => bootstrap(TestComponent))
        .toThrowError(
            `Put bootstrap() inside beforeEach, beforeAll or it. Remember to ` +
            `import 'it', 'beforeEach', 'afterEach' etc. from the catalyst` +
            ` module.`);
    expect(() => get(NgZone))
        .toThrowError(
            `Put get() inside beforeEach, beforeAll or it. Remember to ` +
            `import 'it', 'beforeEach', 'afterEach' etc. from the catalyst` +
            ` module.`);
  });

  it('runs in Catalyst fakeAsync Zone', () => {
    expect(Zone.current.get('Catalyst')).toBe(true);
  });

  it('bootstraps', () => {
    expect(root.textContent).toEqual('Hello World face');
  });

  it('get() retrieves injected object', () => {
    expect(get(NgZone)).not.toBe(null);
  });

  it('runs change detection automatically on event', () => {
    // Click the text.
    getEl('p').click();
    expect(root.textContent).toEqual('Hello Clicked face');
  });

  it('runs change detection after a flush', () => {
    // flush() reflects changes made directly in component instance to DOM.
    comp.name = 'Earth';
    flush();
    expect(root.textContent).toEqual('Hello Earth face');
  });

  it('runs change detection after an async now', () => {
    // now will wait for the async method to finish before running the
    // change detection that will reflect the state to the DOM.
    now(async () => {
      await null;
      comp.name = 'Mars';
    });
    expect(root.textContent).toEqual('Hello Mars face');
  });

  it('runs change detection after a synchronous now', () => {
    now(() => {
      comp.name = 'Mars';
    });
    expect(root.textContent).toEqual('Hello Mars face');
  });

  it('runs test in fakeAsync zone by default', () => {
    const asyncMethod = async () => {
      await null;
      comp.name = 'Mars';
    };

    asyncMethod();  // This queues the async task.
    expect(root.textContent).toEqual('Hello World face');

    flush();  // This processes any queued async tasks.
    expect(root.textContent).toEqual('Hello Mars face');
  });

  it('works with async/await test method', async () => {
    await null;
    comp.name = 'Mars';
    flush();
    expect(root.textContent).toEqual('Hello Mars face');

    await null;
    comp.name = 'Venus';
    flush();
    expect(root.textContent).toEqual('Hello Venus face');
  });

  itLegacy('supports legacy tests by not flushing after `it()`', async () => {
    expect().nothing();  // Suppress warning of 0 assertions in this test.

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      });
    });

    // Not called because the above Promise is not implicitly flushed.
    fail();
  });

  // This complicated setup is needed to check if `it.broken` causes a warning
  // to be printed at the end. The actual expectation is in afterEach.
  describe('with console.warn mocked', () => {
    let spy: jasmine.Spy;
    beforeEach(() => {
      spy = spyOn(console, 'warn');
    });
    // Deprecated version intentionally used here.
    // tslint:disable-next-line:deprecation
    it.broken('prints a warning when returned promise not resolved', () => {
      return new Promise(() => {});
    });
    afterEach(() => {
      expect(spy.calls.count()).toEqual(1);
      expect(spy.calls.mostRecent().args[0])
          .toMatch(/Test returned a promise that didn't resolve within /);
    });
  });

  it('strict works with async/await', async () => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      });
    });

    flush();

    expect(true).toBe(true);
  });

  describe('supports legacy tests by not flushing after `beforeEach()`', () => {
    beforeEachLegacy(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        });
      });

      // Not called because the above Promise is not implicitly flushed.
      fail();
    });

    itLegacy('empty test so `beforeEach()` will run', () => {
      // Suppress warning of 0 assertions in this test.
      expect(true).toBe(true);
    });
  });

  describe('supports legacy tests by not flushing after `afterEach()`', () => {
    afterEachLegacy(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        });
      });

      // Not called because the above Promise is not implicitly flushed.
      fail();
    });

    itLegacy('empty test so `afterEach()` will run', () => {
      // Suppress warning of 0 assertions in this test.
      expect(true).toBe(true);
    });
  });

  it('flushes after `it()`', async () => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      });
    });

    // Called because the above Promise is implicitly flushed.
    expect(true).toBe(true);
  });

  describe('does not flush after `beforeEach()`', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        });
      });

      // Called because the above Promise is implicitly flushed.
      expect(true).toBe(true);
    });

    it('empty test so `beforeEach()` will run', () => {});
  });

  describe('does not flush after `afterEach()`', () => {
    afterEach(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        });
      });

      // Called because the above Promise is implicitly flushed.
      expect(true).toBe(true);
    });

    it('empty test so `afterEach()` will run', () => {});
  });
});

describe('setupModule', () => {
  it('logs unknown element error without CUSTOM_ELEMENTS_SCHEMA', () => {
    const spy = spyOn(console, 'error');
    setupModule({imports: [TestModule]});
    bootstrapTemplate('<custom-el></custom-el>');
    expect(spy.calls.mostRecent().args[0])
        .toMatch(/'custom-el' is not a known element/);
  });

  it('supports schemas', () => {
    setupModule({imports: [TestModule], schemas: [CUSTOM_ELEMENTS_SCHEMA]});
    bootstrapTemplate('<custom-el></custom-el>');  // No errors thrown.
  });
});

describe('catalyst with AOT-compiled modules', () => {
  beforeEach(() => {
    setupModule({
      imports: [AotTestModule],
    });
  });

  it('bootstraps', () => {
    bootstrap(AotTestComponent);
    const root = getEl();  // getEl() is the root app element.
    expect(root.textContent).toEqual('Hello World face\n');
  });

  it('bootstraps again', () => {
    bootstrap(AotTestComponent);
    const root = getEl();  // getEl() is the root app element.
    expect(root.textContent).toEqual('Hello World face\n');
  });

  it('can throw before and after bootstrap', () => {
    expect(() => {
      now(() => {
        throw new Error('Error in now before bootstrap');
      });
    }).toThrowError(/Error in now before bootstrap/);

    bootstrap(AotTestComponent);
    const root = getEl();  // getEl() is the root app element.
    expect(root.textContent).toEqual('Hello World face\n');

    expect(() => {
      now(() => {
        throw new Error('Error in now after bootstrap');
      });
    }).toThrowError(/Error in now after bootstrap/);
  });
});

describe('catalyst with AOT-compiled modules', () => {
  beforeEach(() => {
    setupModule({
      imports: [AotTestModule],
      templateOverrides: [{
        component: AotTestComponent,
        template: `Template overridden`,
      }]
    });
  });

  it('can override templates', () => {
    bootstrap(AotParentComponent);
    expect(getEl().textContent).toEqual('Template overridden');
  });

  it('can override templates with bootstrapTemplate', () => {
    bootstrapTemplate(`<aot-test-component></aot-test-component>`, {});
    expect(getEl().textContent).toEqual('Template overridden');
  });
});

describe('Automatic event queue processing', () => {
  it('turned off during change detection cycle', () => {
    setupModule({imports: [TestModule]});

    // Component is able to bootstrap without
    // ExpressionChangedAfterItHasBeenCheckedError.
    bootstrap(TestComponent9);
    expect(getEl().textContent).toBe('Hello World');
  });

  it('turned off in RenderFactory2::end()', () => {
    setupModule({imports: [TestModule]});

    // Create a RendererFactory2 that triggers events in rf.end(). This can
    // happen, for example, when the animation engine removes an element that
    // has focus in rf.end(), which triggers a focusout event. See b/128703586
    // for details.
    const rf = get(RendererFactory2);
    const origEnd = rf.end!;
    rf.end = () => {
      const el = getEl('div');
      if (el) {
        trigger(el, 'click');
      }
      origEnd.apply(rf);
    };

    const comp = bootstrap(TestComponent9);

    // Component is able to update in a microtask without triggering a
    // ExpressionChangedAfterItHasBeenCheckedError.
    comp.updateWithMicrotask();
    flush();

    expect(getEl().textContent).toBe('Hello Universe');
  });
});

describe('afterEach', () => {
  let comp: DestroyTestComponentParent;
  let destroy: {};

  beforeEach(() => {
    setupModule({imports: [TestModule]});
  });

  // The following test depends on this one. We could test afterEach
  // behavior with an afterAll, but exceptions in afterAll
  // are not handled in karma jasmine. See
  // https://github.com/karma-runner/karma-jasmine/issues/161
  it('sets up the next test', () => {
    comp = bootstrap(DestroyTestComponentParent);
    destroy = comp.onDestroySpy;
  });

  it('destroys the component after each test', () => {
    expect(destroy).toHaveBeenCalled();
  });
});

describe('beforeEach.async', () => {
  let testVariable: string;

  beforeEach.async(async () => {
    testVariable = 'iAlwaysGetTheShemp';

    const asyncMethod = async () => {
      await null;
      testVariable = 'youGotThatShemp';
    };
    await asyncMethod();
  });

  it('runs async tasks before each test', () => {
    expect(testVariable).toEqual('youGotThatShemp');
  });
});

describe('flush', () => {
  beforeEach(() => {
    setupModule({imports: [TestModule]});
  });

  it('can be called before bootstrap', () => {
    let run = false;
    now(() => {
      setTimeout(() => {
        run = true;
      }, 100);
    });
    expect(run).toBe(false);
    flush();
    expect(run).toBe(true);
  });

  it('handles async tasks scheduled during change detection', () => {
    let resolved = false;
    const instance = {
      name: 'World',
      onResolved: () => {
        resolved = true;
      }
    };
    bootstrapTemplate(
        `<test-component-4 [name]="name" (resolved)="onResolved()">
       </test-component-4>`,
        instance);
    instance.name = 'Changed';
    flush();
    expect(getEl().textContent).toBe('Hello Changed');
    expect(resolved).toBe(true);
  });

  it('flushes periodic timers at least once', () => {
    let x = 0, y = 0;
    const start = Date.now();
    now(() => {
      setInterval(() => {
        x++;
      }, 100);
      setInterval(() => {
        y++;
      }, 400);
    });
    flush();
    expect(x).toBe(4);
    expect(y).toBe(1);
    expect(Date.now() - start).toBe(400);
  });

  it('flushes requestAnimationFrame', () => {
    let run = false;
    const start = Date.now();
    let end = 0;
    now(() => {
      requestAnimationFrame(() => {
        run = true;
        end = Date.now();
      });
    });
    flush();
    expect(run).toBe(true);
    expect(end - start).toBe(16);
  });

  it('flushes RxJS scheduler', () => {
    const seen: number[] = [];
    const observable = from([1, 2, 3]).pipe(delay(500));
    now(() => {
      observable.subscribe(data => {
        seen.push(data);
      });
    });
    expect(seen).toEqual([]);
    flush();
    expect(seen).toEqual([1, 2, 3]);
  });

  it('flushes RxJS debounceTime', () => {
    let seen = 0;
    now(() => {
      const observable = new Observable<number>((obs: Observer<number>) => {
        obs.next(42);
      });
      observable.pipe(debounceTime(100)).subscribe((data: number) => {
        seen = data;
      });
    });
    expect(seen).toBe(0);
    tick(101);
    expect(seen).toBe(42);
  });
});

describe('markForCheckAndFlush', () => {
  beforeEach(() => {
    setupModule({imports: [TestModule]});
  });

  it('updates template of component with on push strategy after input changing',
     () => {
       const comp = bootstrap(TestComponent11);

       // reference type input
       comp.obj = {name: 'Banana'};
       markForCheckAndFlush();
       expect(getEl().textContent).toBe('Name: Banana. Age: 32.');

       // pritimive type input
       comp.primitive = 42;
       markForCheckAndFlush();
       expect(getEl().textContent).toBe('Name: Banana. Age: 42.');
     });
});

describe('bootstrap', () => {
  beforeEach(() => {
    setupModule({imports: [TestModule]});
  });

  it('can be called after get()', () => {
    get(NameService);
    bootstrap(TestComponent);
    expect(getEl().textContent).toEqual('Hello World face');
  });

  it('binds input values', () => {
    const inputVal = 'banana';
    const comp = bootstrap(TestComponent3, {
      inputVal,
    });

    expect(comp.ngOnInitCalledTimes).toBe(1);
    expect(comp.ngOnInitInputVal).toBe(inputVal);
  });

  it('runs async tasks in onInit', () => {
    const comp = bootstrap(TestComponent5, {name: 'World'});
    expect(comp.resolved).toBe(true);
  });

  it('runs "init" before initial change detection', () => {
    bootstrap(TestComponent6, {}, (component: TestComponent6) => {
      spyOn(component, 'getName').and.returnValue('Spy');
    });
    expect(getEl().textContent).toBe('Hello Spy');
  });

  it('does not flush if flush is turned off', () => {
    const comp = bootstrap(
        TestComponent5, {name: 'World'}, undefined, false /* flush */);
    expect(getEl().textContent).toBe('Hello World');
    expect(comp.resolved).toBe(false);
  });
});

describe('bootstrap from template string', () => {
  beforeEach(() => {
    setupModule({imports: [TestModule]});
  });

  it('works', () => {
    bootstrapTemplate(
        `<test-component [name]="name" (click)="name = 'Clicked'">
        </test-component>`,
        {name: 'Earth'});
    const root = getEl();
    expect(root.textContent).toBe('Hello Earth face');
    getEl('test-component').click();
    expect(root.textContent).toBe('Hello Clicked face');
  });

  it('reflects change in component instance after now()', () => {
    const instance = {
      name: 'Earth',
      click: () => {
        instance.name = 'Clicked';
      }
    };
    bootstrapTemplate(
        '<test-component [name]="name"></test-component>', instance);
    const root = getEl();
    expect(root.textContent).toBe('Hello Earth face');
    now(() => instance.name = 'Venus');
    expect(root.textContent).toBe('Hello Venus face');
    now(() => {
      instance.click();
    });
    expect(root.textContent).toBe('Hello Clicked face');
  });

  it('cannot be called after get()', () => {
    get(NameService);
    expect(() => {
      bootstrapTemplate('<test-component></test-component>', {});
    }).toThrowError('Cannot call bootstrapTemplate() after get()');
  });

  it('runs "init" before initial change detection', () => {
    bootstrapTemplate('<test-component-6></test-component-6>', {}, () => {
      const testComponent = getDebugEl(TestComponent6).componentInstance;
      spyOn(testComponent, 'getName').and.returnValue('Spy');
    });
    expect(getEl().textContent).toBe('Hello Spy');
  });

  it('does not flush if flush is turned off', () => {
    bootstrapTemplate(
        '<test-component-5 name="World"></test-component-5>', {}, undefined,
        false /* flush */);
    const comp = getDebugEl(TestComponent5).componentInstance;
    expect(getEl().textContent).toBe('Hello World');
    expect(comp.resolved).toBe(false);
  });

  it('allows controller fields to be enumerated', () => {
    bootstrapTemplate('<test-component></test-component>', {foo: 1, bar: 2});
    const resolved = getDebugEl().componentInstance;
    // Ivy adds an extra '__ngContext__' property so directy check just index 1
    // and 2 so this passes with VE as well.
    expect(Object.keys(resolved)[0]).toEqual('foo');
    expect(Object.keys(resolved)[1]).toEqual('bar');
  });
});

describe('bootstrap with onpush', () => {
  beforeEach(() => {
    setupModule({imports: [TestModule]});
  });

  it('supports components with onpush change detection', () => {
    const instance = {obj: {name: 'name'}};
    bootstrapTemplate(
        `<test-component-10 [obj]="obj"></test-component-10>`, instance);
    expect(getEl().textContent).toBe('Name: name');

    now(() => instance.obj.name = 'new name');
    expect(getEl().textContent).not.toBe('Name: new name');

    now(() => instance.obj = {name: 'third name'});
    expect(getEl().textContent).toBe('Name: third name');
  });
});

describe('finding els', () => {
  beforeEach(() => {
    setupModule({imports: [TestModule]});
    bootstrapTemplate(
        `<test-component name="foo"></test-component>
       <test-component name="bar"></test-component>
       <a href="http://google.com/">google</a>
       <input type="text" value="val">`,
        {a: 10});
  });

  it('returns whether an element is present', () => {
    expect(hasEl('p')).toBe(true);
    expect(hasEl('header')).toBe(false);
  });

  it('finds element by CSS', () => {
    expect(getEl('p')).not.toBe(null);
  });

  it('getEl() throws an exception if element is not found', () => {
    expect(() => getEl('header'))
        .toThrowError('Element not found for "header"');
  });

  it('getEl() returns proper subtypes for simple selectors', () => {
    expect(getEl('a').href).toEqual('http://google.com/');
    expect(getEl('input').value).toEqual('val');
  });

  it('finds all elements queried by CSS', () => {
    const els = getEls('p');
    expect(els.length).toBe(2);
    expect(els[0].textContent).toBe('Hello foo face');
    expect(els[1].textContent).toBe('Hello bar face');
  });

  it('finds a debug element by type', () => {
    const debug = getDebugEl(TestComponent);
    expect(debug.componentInstance.name).toEqual('foo');
  });

  it('finds a debug element by CSS', () => {
    const debug = getDebugEl('[name="bar"]');
    expect(debug.componentInstance.name).toEqual('bar');
  });

  it('find root debug element', () => {
    expect(getDebugEl().componentInstance.a).toEqual(10);
  });

  it('finds debug elements by type', () => {
    const debugs = getDebugEls(TestComponent);
    expect(debugs.length).toEqual(2);
    expect(debugs[0].componentInstance.name).toEqual('foo');
    expect(debugs[1].componentInstance.name).toEqual('bar');
  });

  it('finds debug elements by CSS', () => {
    const debugs = getDebugEls('test-component');
    expect(debugs.length).toEqual(2);
    expect(debugs[0].componentInstance.name).toEqual('foo');
    expect(debugs[1].componentInstance.name).toEqual('bar');
  });

  it('locates debug elements', () => {
    expect(hasDebugEl(TestComponent)).toBe(true);
    expect(hasDebugEl('test-component')).toBe(true);
    expect(hasDebugEl(TestComponent2)).toBe(false);
    expect(hasDebugEl('test-component-2')).toBe(false);
  });

  it('getDebugEl() throws an exception if element is not found', () => {
    expect(() => getDebugEl(TestComponent2))
        .toThrowError(`DebugElement not found for "${TestComponent2}"`);
  });
});

describe('finding els in given root', () => {
  let root: HTMLElement;
  let rootDebugElement: DebugElement;

  beforeEach(() => {
    setupModule({imports: [TestModule]});
    bootstrapTemplate(
        `
       <span id="first"><div>foo0</div><div>foo1</div></span>
       <span id="second"><p>bar0</p><p>bar1</p></span>`,
        {});
    root = getEl('span#second');
    rootDebugElement = getDebugEl('span#second');
  });

  it('returns whether an element is present', () => {
    expect(hasEl('p', root)).toBe(true);
    expect(hasEl('div', root)).toBe(false);
  });

  it('finds element by CSS', () => {
    const el = getEl('p', root);
    expect(el).not.toBe(null);
    expect(el.textContent).toBe('bar0');
  });

  it('getEl() throws an exception if element is not found', () => {
    expect(() => getEl('div', root))
        .toThrowError('Element not found for "div"');
  });

  it('finds all elements queried by CSS', () => {
    const els = getEls('p', root);
    expect(els.length).toBe(2);
    expect(els[0].textContent).toBe('bar0');
    expect(els[1].textContent).toBe('bar1');
  });

  it('returns whether a debug element is present', () => {
    expect(hasDebugEl('p', rootDebugElement)).toBe(true);
    expect(hasDebugEl('div', rootDebugElement)).toBe(false);
  });

  it('finds debug element by CSS', () => {
    const el = getDebugEl('p', rootDebugElement);
    expect(el).not.toBe(null);
    expect(el.nativeElement.textContent).toBe('bar0');
  });

  it('getDebugEl() throws an exception if element is not found', () => {
    expect(() => getDebugEl('div', rootDebugElement))
        .toThrowError('DebugElement not found for "div"');
  });

  it('finds all debug elements queried by CSS', () => {
    const els = getDebugEls('p', rootDebugElement);
    expect(els.length).toBe(2);
    expect(els[0].nativeElement.textContent).toBe('bar0');
    expect(els[1].nativeElement.textContent).toBe('bar1');
  });
});

const mockedTestDate = new Date('22 Jan 1983 12:00:00 GMT');

describeWithDate('task control', mockedTestDate, () => {
  let root: HTMLElement;
  beforeEach(() => {
    expect(new Date()).toEqual(mockedTestDate);
    setupModule({imports: [TestModule]});
    bootstrap(TestComponent2);
    root = getEl();
  });

  it('tick advances mock Date', () => {
    tick(1000);
    expect(Date.now()).toBe(new Date('22 Jan 1983 12:00:01 GMT').getTime());
  });

  it('tick works with RxJS scheduler', () => {
    const seen: number[] = [];
    const observable = from([1, 2, 3]).pipe(delay(500));
    now(() => {
      observable.subscribe(data => {
        seen.push(data);
      });
    });
    expect(seen).toEqual([]);
    tick(500);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('tick can advance clock to trigger timers', () => {
    expect(root.textContent).toEqual('Hello World');
    getEl('p').click();
    expect(root.textContent).toEqual('Hello Clicked');
    tick(1000);
    expect(root.textContent).toEqual('Hello Timeout');
  });

  it('flush can trigger all queued timers', () => {
    expect(root.textContent).toEqual('Hello World');
    getEl('p').click();
    expect(root.textContent).toEqual('Hello Clicked');
    flush();
    expect(root.textContent).toEqual('Hello Timeout');
  });
});

describe('changing the test module', () => {
  it('is able to declare components via setupModule', () => {
    setupModule({imports: [MatIconModule], declarations: [TestComponent]});
    bootstrap(TestComponent);

    expect(getEl().textContent).toEqual('Hello World face');
  });

  it('is able to declare regular providers via setupModule', () => {
    const mockName = {name: 'mock name'};
    setupModule({
      imports: [TestModule],
      providers: [{provide: NameService, useValue: mockName}],
    });
    bootstrap(TestComponent7);

    // Getting through the top-level injector should return the mocked one.
    expect(get(NameService).name).toBe('mock name');

    // Regular providers cannot override Component level providers
    expect(getEl().textContent).toBe('Hello original');
  });

  it('is able to add multiproviders via setupModule', () => {
    setupModule({
      imports: [TestModule],
      providers: [
        {provide: MULTI_NAME_SERVICE, useValue: {name: 'Name2'}, multi: true}
      ],
    });
    bootstrap(TestComponent8);

    expect(getEl().textContent).toBe('Hello Name1 Name2');
  });

  it('overrides providers from anywhere', () => {
    const mockName = {name: 'mock name'};
    setupModule({
      imports: [TestModule],
      superProviders: [{provide: NameService, useValue: mockName}]
    });

    const component = bootstrap(TestComponent7);
    expect(component.getName()).toEqual('mock name');

    // Make sure that useValue uses the exact object.
    expect(component.nameService).toBe(mockName);
  });

  it('overrides providers from anywhere when providers is an array', () => {
    const mockName = {name: 'mock name'};
    setupModule({
      imports: [TestModule],
      superProviders: [[{provide: NameService, useValue: mockName}]]
    });

    const component = bootstrap(TestComponent7);
    expect(component.getName()).toEqual('mock name');

    // Make sure that useValue uses the exact object.
    expect(component.nameService).toBe(mockName);
  });

  it('overrides providers not provided by any NgModule', () => {
    const mockName = {name: 'mock name'};
    setupModule({
      imports: [TestModule],
      superProviders: [{provide: UnProvidedService, useValue: mockName}]
    });

    const service = get(UnProvidedService);
    expect(service.name).toEqual('mock name');

    // Make sure that useValue uses the exact object.
    expect(service).toBe(mockName);
  });
});

describe('helper functions', () => {
  it('triggers event', () => {
    setupModule({imports: [TestModule]});
    const spyHandler = jasmine.createSpy('handler');
    bootstrapTemplate('<input>', {});
    const input = getEl('input');
    input.addEventListener('focus', spyHandler);

    trigger(input, 'focus');
    expect(spyHandler).toHaveBeenCalled();

    // Remove event listener so the node could be fully removed from memory
    input.removeEventListener('focus', spyHandler);
  });

  it('triggers a keyboard event without parameter', () => {
    setupModule({imports: [TestModule]});
    const spyHandler = jasmine.createSpy('handler');
    bootstrapTemplate('<div>', {});
    const div = getEl('div');
    div.addEventListener('keypress', spyHandler);

    trigger(div, 'keypress');
    expect(spyHandler).toHaveBeenCalled();

    // Remove event listener so the node could be fully removed from memory
    div.removeEventListener('keypress', spyHandler);
  });

  it('triggers a keyboard event with a keyCode', () => {
    setupModule({imports: [TestModule]});
    const spyHandler = jasmine.createSpy('handler');
    bootstrapTemplate('<div>', {});
    const div = getEl('div');
    div.addEventListener('keypress', spyHandler);

    trigger(div, 'keypress', {code: 'ENTER'}, {'keyCode': 13});
    expect(spyHandler)
        .toHaveBeenCalledWith(
            jasmine.objectContaining({code: 'ENTER', keyCode: 13}));

    // Remove event listener so the node could be fully removed from memory
    div.removeEventListener('keypress', spyHandler);
  });
});

describe('service testing', () => {
  it('can inject a service without bootstrapping a component', () => {
    const mockName = {name: 'mock name'};
    setupModule({
      imports: [TestModule],
      superProviders: [{provide: NameService, useValue: mockName}]
    });

    const service = get(NameService);
    expect(service.name).toEqual('mock name');

    // Make sure that useValue uses the exact object.
    expect(service).toBe(mockName);
  });
});

describe('typed blocks', () => {
  interface Context {
    a: number;
  }

  beforeEach(function(this: Context) {
    expect(this.a).toBeUndefined();
    this.a = 10;
  });

  it('work', function(this: Context) {
    expect(this.a).toBe(10);
  });

  it('work again with context cleared', function(this: Context) {
    expect(this.a).toBeGreaterThan(9);
  });
});

describe('SVG elements', () => {
  beforeEach(() => {
    setupModule({
      imports: [TestModule],
    });
    bootstrap(SvgTestComponent);
  });

  it('getEl can get an SVG element', () => {
    const svg = getEl('svg');
    expect(svg.id).toEqual('1');

    const circle = getEl('circle', svg);
    expect(circle.id).toEqual('circle');
  });

  it('getEls can get SVG elements', () => {
    const svgs = getEls('svg');

    expect(svgs.length).toEqual(2);
    expect(svgs[0].id).toEqual('1');
    expect(svgs[1].id).toEqual('2');
  });

  it('getDebugEl can get an SVG element', () => {
    const svg = getDebugEl('svg').nativeElement;
    expect(svg.id).toEqual('1');

    const circle = getDebugEl('circle', getDebugEl('svg')).nativeElement;
    expect(circle.id).toEqual('circle');
  });

  it('getDebugEls can get SVG elements', () => {
    const svgs = getDebugEls('svg');

    expect(svgs.length).toEqual(2);
    expect(svgs[0].nativeElement.id).toEqual('1');
    expect(svgs[1].nativeElement.id).toEqual('2');
  });
});

describe('destroyTestComponent', () => {
  beforeEach(() => {
    setupModule({
      imports: [TestModule],
    });
    bootstrapTemplate(`<destroy-test-component-parent>
                      </destroy-test-component-parent>
                      <destroy-test-component-child>
                      </destroy-test-component-child>`);
  });

  it('causes destroys all children components', () => {
    const parentOnDestroy =
        getDebugEl(DestroyTestComponentParent).componentInstance.onDestroySpy;
    expect(parentOnDestroy).toHaveBeenCalledTimes(0);

    const childOnDestroys =
        getDebugEls(DestroyTestComponentChild)
            .map(child => child.componentInstance.onDestroySpy);

    expect(childOnDestroys.length).toBe(2);
    expect(childOnDestroys[0]).toHaveBeenCalledTimes(0);
    expect(childOnDestroys[1]).toHaveBeenCalledTimes(0);

    destroyTestComponent();

    expect(parentOnDestroy).toHaveBeenCalledTimes(1);
    expect(childOnDestroys[0]).toHaveBeenCalledTimes(1);
    expect(childOnDestroys[1]).toHaveBeenCalledTimes(1);

    // Second destroy does fails.
    expect(() => {
      destroyTestComponent();
    }).toThrowError('Please call bootstrap() first');
  });
});

//----------- Components under test. Usually in a different file.--------------
@Component({
  preserveWhitespaces: true,
  selector: 'test-component',
  template: `<p (click)="click()">Hello {{name}} <mat-icon>face</mat-icon></p>`,
})
class TestComponent implements OnDestroy {
  @Input() name = 'World';

  click() {
    Promise.resolve(null).then(() => null).then(() => this.name = 'Clicked');
  }

  ngOnDestroy() {}
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-2',
  template: '<p (click)="click()">Hello {{name}}</p>',
})
class TestComponent2 {
  name = 'World';

  click() {
    this.name = 'Clicked';
    setTimeout(
        () => Promise.resolve(null).then(() => this.name = 'Timeout'), 1000);
  }
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-3',
  template: '<div></div>',
})
class TestComponent3 implements OnInit {
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  @Input() inputVal!: string;

  ngOnInitCalledTimes = 0;
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  ngOnInitInputVal!: string;

  ngOnInit() {
    this.ngOnInitCalledTimes++;
    this.ngOnInitInputVal = this.inputVal;
  }
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-4',
  template: '<div>Hello {{name}}</div>',
})
class TestComponent4 implements OnChanges {
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  @Input() name!: string;

  @Output() resolved = new EventEmitter<boolean>();

  ngOnChanges() {
    Promise.resolve().then(() => {
      this.resolved.emit(true);
    });
  }
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-5',
  template: '<div>Hello {{name}}</div>',
})
class TestComponent5 implements OnInit {
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  @Input() name!: string;

  resolved = false;

  ngOnInit() {
    Promise.resolve().then(() => {
      this.resolved = true;
    });
  }
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-6',
  template: '<div>Hello {{getName()}}</div>',
})
class TestComponent6 {
  getName() {
    return 'World';
  }
}

@Injectable()
class UnProvidedService {
  name = 'original';
}

@Injectable()
class NameService {
  name = 'original';
}

@Injectable()
class MultiNameService {
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  name!: string;
}

const MULTI_NAME_SERVICE =
    new InjectionToken<MultiNameService[]>('MultiNameService');

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-7',
  template: '<div>Hello {{getName()}}</div>',
  providers: [NameService],
})
class TestComponent7 {
  constructor(readonly nameService: NameService) {}

  getName() {
    return this.nameService.name;
  }
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-8',
  template: '<div>Hello{{getName()}}</div>',
})
class TestComponent8 {
  constructor(@Inject(MULTI_NAME_SERVICE) private nameServices:
                  MultiNameService[]) {}

  getName() {
    let name = '';
    this.nameServices.forEach(s => {
      name += ' ' + s.name;
    });
    return name;
  }
}

@Component({
  preserveWhitespaces: true,
  selector: 'test-component-9',
  template: '<div #root (click)="clicked()">Hello {{name}}</div>',
})
class TestComponent9 implements AfterViewInit {
  name = '';

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  @ViewChild('root', {static: false}) root!: ElementRef;

  ngAfterViewInit() {
    // Changing name as part of change detection, but in the next tick should
    // be ok.
    Promise.resolve(null).then(() => {
      this.name = 'World';
    });

    // Trigger an event handler during the change detection. This should
    // not cause the above Promise to be processed in the same tick.
    this.root.nativeElement.click();
  }

  clicked() {
    // empty.
  }

  // Queue up a microtask that changes a binding. This should never cause an
  // ExpressionChangedAfterItHasBeenCheckedError
  updateWithMicrotask() {
    Promise.resolve(null).then(() => {
      this.name = 'Universe';
    });
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  preserveWhitespaces: true,
  selector: 'test-component-10',
  template: `Name: {{obj.name}}`,
})
class TestComponent10 {
  @Input() obj: {name?: string} = {};
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'test-component-11',
  template: `Name: {{obj.name}}. Age: {{primitive}}.`,
})
class TestComponent11 {
  @Input() obj: {name?: string} = {};
  @Input() primitive = 32;
}

@Component({
  selector: 'svg-test-component',
  template: `<svg id="1"><circle id="circle"></circle></svg><svg id="2"></svg>`,
})
class SvgTestComponent {
}

@Component({
  selector: 'destroy-test-component-parent',
  template: '<destroy-test-component-child></destroy-test-component-child>'
})
class DestroyTestComponentParent implements OnDestroy {
  readonly onDestroySpy =
      jasmine.createSpy('DestroyTestComponentParent#onDestroy');

  ngOnDestroy() {
    this.onDestroySpy();
  }
}

@Component({selector: 'destroy-test-component-child', template: ''})
class DestroyTestComponentChild implements OnDestroy {
  readonly onDestroySpy =
      jasmine.createSpy('DestroyTestComponentChild#onDestroy');

  ngOnDestroy() {
    this.onDestroySpy();
  }
}

@NgModule({
  declarations: [
    TestComponent,
    TestComponent2,
    TestComponent3,
    TestComponent4,
    TestComponent5,
    TestComponent6,
    TestComponent7,
    TestComponent8,
    TestComponent9,
    TestComponent10,
    TestComponent11,
    SvgTestComponent,
    DestroyTestComponentParent,
    DestroyTestComponentChild,
  ],
  imports: [MatIconModule],
  providers: [
    NameService,
    {provide: MULTI_NAME_SERVICE, useValue: {name: 'Name1'}, multi: true},
  ],
  exports: [
    TestComponent,
    TestComponent4,
    TestComponent5,
    TestComponent6,
    TestComponent7,
    TestComponent8,
    TestComponent9,
    TestComponent10,
    TestComponent11,
    SvgTestComponent,
    DestroyTestComponentParent,
    DestroyTestComponentChild,
  ],
})
class TestModule {
}
