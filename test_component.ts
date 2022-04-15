import {Component, Input, NgModule} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

@Component({
  preserveWhitespaces: true,
  selector: 'aot-test-component',
  templateUrl: './test_component.ng.html',
})
export class AotTestComponent {
  @Input()
  name = 'World';

  click() {}
}

@Component({
  preserveWhitespaces: true,
  selector: 'aot-parent-test-component',
  template: `<aot-test-component name="World"></aot-test-component>`,
})
export class AotParentComponent {}

@NgModule({
  imports: [MatIconModule],
  declarations: [AotParentComponent, AotTestComponent],
  exports: [AotTestComponent],
})
export class AotTestModule {
}
